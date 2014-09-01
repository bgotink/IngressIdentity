# Interpret, cache and merge player data.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    exports = if Object.has(module, 'data') then module.data else module.data = {}

    # unexported helper functions and classes

    resolveKey = (key, parent, err) ->
        data = exports.spreadsheets.parseKey key

        if not Object.isString(data.key) or data.key.isBlank()
            parentData = exports.spreadsheets.parseKey parent

            if not Object.isString(parentData.key) or parentData.key.isBlank()
                if err?
                    err.push 'Cannot resolve key ' + key
                return ''

            data.key = exports.spreadsheets.parseKey(parent).key

        if Object.has data, 'gid'
            '{key}?gid={gid}'.assign data
        else
            data.key

    class PlayerSource
        constructor: (key, spreadsheet, data, players) ->
            @key = key
            @spreadsheet = spreadsheet
            @data = data
            @err = data.getErr()
            @timestamp = +new Date()

            @setPlayers players

            @loadingErrors = null

        setPlayers: (players) ->
            @players = {}
            newPlayers = @players

            players.each (player) ->
                if not (Object.isNumber(player.oid) or Object.isString(player.oid)) or ('' + player.oid).match(/^9*$/)
                    return

                newPlayers[player.oid] = player

        hasPlayer: (oid) -> Object.has @players, oid
        getPlayer: (oid) ->
            return null unless @hasPlayer oid

            player = exports.interpreter.interpretSourceEntry @data, @players[oid]
            player.source =
                url: @getUrl()
                tag: @getTag()

            player

        getNbPlayers: -> Object.size @players

        getKey: -> @key
        getTag: -> @data.getTag()
        getVersion: -> @data.getVersion()
        getFaction: -> @data.getFaction()

        getTimestamp: -> @timestamp
        getUpdateInterval: -> Math.floor(@data.refresh) * 60 * 60 * 1000

        isCombined: -> false

        shouldUpdate: -> (+new Date()) > (@getTimestamp() + @getUpdateInterval())
        setUpdated: -> @timestamp = +new Date()
        update: (callback) ->
            self = @

            module.log.log 'Updating source %s', @getKey()
            @spreadsheet.load (err, players) ->
                if (players)
                    module.log.log 'Had %d players, now %d', self.players.length, players.length
                    self.setPlayers players
                    self.setUpdated()

                    if err?
                        err.each module.log.warn

                    callback true
                else
                    err.each module.log.error

                    callback false

        hasErrors: -> @loadingErrors?.length > 0 or @err?.length > 0
        getErrors: -> if @loadingErrors? then @loadingErrors.union @err else @err

        hasLoadingErrors: -> !!@loadingErrors
        setLoadingErrors: (err) ->
            if not err? or not Array.isArray err
                @loadingErrors = null
            else
                @loadingErrors = if err.length is 0 then null else err

        getUrl: -> @spreadsheet.getUrl()

        hasExtra: (tag, oid) -> @data.hasExtra tag, oid

        find: (pattern) ->
            oids = []

            Object.each Object.findAll(@players, pattern), (oid) ->
                    oids.push oid

            oids


    class ErroredPlayerSource
        constructor: (key, err, data) ->
            @key = key
            @err = err
            @data = data or null

        getKey: -> @key
        getTag: -> @data and @data.getTag()
        getVersion: -> @data and @data.getVersion()
        getFaction: -> @data and @data.getFaction()

        hasPlayer: -> false
        getPlayer: -> null

        getNbPlayers: -> 0

        getUrl: -> exports.spreadsheets.keyToUrl @key

        hasErrors: -> true
        getErrors: -> @err

        hasLoadingErrors: -> true
        setLoadingErrors: (err) ->
            if err?
                @loadingErrors = err

        hasExtra: -> false

        getTimestamp: -> +new Date
        getUpdateInterval: -> Infinity

        isCombined: -> false

        shouldUpdate: -> false
        setUpdated: ->
        update: (callback) -> callback false

        find: -> []

    class CombinedPlayerSource
        constructor: (sources, key, spreadsheet) ->
            @sources = sources

            @key = key or 0
            @spreadsheet = spreadsheet or null

            @cache = {}
            @timestamp = +new Date

            @loadingErrors = null

            @topLevel = false

        setTopLevel: ->
            @topLevel = true
            @

        getKey: -> @key

        hasPlayer: (oid) ->
            if typeof @cache[oid] isnt 'undefined'
                return @cache[oid] isnt null

            @sources.some (source) ->
                source.hasPlayer oid
        getPlayer: (oid) ->
            if Object.has @cache, oid
                return @cache[oid]

            data = [ {} ]
            err = []

            @getSources().each (source) ->
                result = source.getPlayer oid

                if result isnt null
                    data.push result

            if data.length < 2
                return @cache[oid] = null

            module.log.log 'Merging ', data, ' into one player object:'

            result = exports.merge data, err
            if @topLevel
                exports.merge.validate result, err

            module.log.log 'Got', result, 'errors', err

            if Object.has result, 'err'
                result.err = result.err.concat err
            else
                result.err = err

            @cache[oid] = result

        getSources: -> @sources
        getSource: (key) ->
            length = @sources.length
            key = resolveKey key, @getKey(), []

            for i in [0..length-1]
                if @sources[i].getKey() is key
                    return @sources[i]

            null

        isCombined: -> true

        invalidateCache: ->
            @getSources().each (source) ->
                if source.isCombined()
                    source.invalidateCache()

            @cache = {}

        shouldUpdateRemote: (remoteTimestamp) -> remoteTimestamp < @timestamp
        shouldUpdate: -> true
        update: (callback) ->
            origCallback = callback
            self = @
            callback = (updated) ->
                if updated
                    @timestamp = +new Date()

                origCallback updated

            if @spreadsheet?
                module.log.log 'Updating manifest %s', @key
                @spreadsheet.load (err, data) ->
                    length = data.length

                    step = (i, updated) ->
                        if i >= length
                            callback updated
                            return

                        source = self.getSource data[i].key
                        if not source?
                            loadSource data[i], self.key, (err, source) ->
                                if source
                                    module.log.log 'Adding new source sheet %s', data[i].key
                                    self.sources.push source
                                    if err?
                                        err.each module.log.warn

                                    step i + 1, true
                                else
                                    if err? and err.length isnt 0
                                        module.log.error 'Error occured while adding source'
                                        err.each module.log.error

                                    step i + 1, updated
                        else
                            if source.shouldUpdate()
                                if source.getVersion() isnt data[i].lastupdated
                                    module.log.log 'Updating source sheet %s from version %s to %s', data[i].key, source.getVersion(), data[i].lastupdated
                                    source.data = data[i]
                                    source.update (u) ->
                                        step i + 1, updated || u
                                else
                                    source.setUpdated()
                                    step i + 1, updated
                            else
                                step i + 1, updated

                    step 0, false
            else
                length = @sources.length

                module.log.log 'Updating collection of manifests'
                step = (i, updated) ->
                    if i >= length
                        callback updated
                        return

                    if self.sources[i].shouldUpdate()
                        self.sources[i].update (u) ->
                            step i + 1, updated || u
                    else
                        step i + 1, updated

                step 0, false

            @

        hasErrors: ->
            @getSources().some (source) ->
                source.hasErrors()
        getErrors: ->
            errors = {}

            @getSources().each (source) ->
                if source.hasErrors()
                    errors[source.getKey()] = source.getErrors()

            $.extend true, {}, errors, @loadingErrors

        hasLoadingErrors: ->
            !!@loadingErrors || @getSources().some (source) ->
                source.hasLoadingErrors()
        setLoadingErrors: (err) ->
            if not err? or not Array.isArray err
                @loadingErrors = null
            else
                @loadingErrors = if err.length is 0 then null else err
                return

            @getSources().each (source) ->
                if Object.isObject(err) and Object.has(err, source.getKey())
                    source.setLoadingErrors err[source.getKey()]
                else
                    source.setLoadingErrors null

        getUrl: -> if @spreadsheet? then @spreadsheet.getUrl() else null

        getSourcesForExtra: (tag, oid) ->
            result = []

            @getSources().each (source) ->
                if source.isCombined()
                    result.push source.getSourcesForExtra tag, oid
                else if source.hasExtra tag, oid
                    result.push [{
                        url: source.getUrl(),
                        key: source.getTag()
                    }]

            result.flatten()

        find: (pattern) ->
            if @topLevel
                stdPattern = module.data.createStandardPlayerFinder pattern
                pattern = module.data.createPlayerFinder pattern
                result = []

                @getSources().each (source) ->
                    result = result.union source.find stdPattern

                return result.map (oid) =>
                        @getPlayer oid
                    .findAll pattern
            else # not @topLevel
                result = []

                @getSources().each (source) ->
                    result = result.union source.find pattern

                result

    loadSource = (data, parentKey, callback) ->
        err = []
        key = resolveKey data.key, parentKey or '', err
        source = new exports.spreadsheets.Source key

        # ignore dummy rows!
        if key.compact().match /^9+$/
            callback null, null
            return

        source.load (err2, players) ->
            if err2?
                err = err.concat err2

            if not players?
                callback err, new ErroredPlayerSource(key, err, exports.interpreter.interpretManifestEntry data)
            else
                callback err, new PlayerSource key, source, exports.interpreter.interpretManifestEntry(data), players

    loadManifest = (key, callback) ->
        manifest = new exports.spreadsheets.Manifest key
        sources = []

        manifest.load (merr, sourcesData) ->
            module.log.log 'Loaded manifest ', key, ', got ', sourcesData, 'err: ', merr

            err = {}
            if merr?
                err.__errors = merr

            if not sourcesData?
                callback err, new ErroredPlayerSource key, err
                return

            nbSources = sourcesData.length
            step = (i) ->
                if i >= nbSources
                    callback (if Object.size(err) > 0 then err else null), new CombinedPlayerSource(sources, key, manifest)
                    return

                skey = sourcesData[i].key

                loadSource sourcesData[i], key, (err2, source) ->
                    if err2?
                        err[if not source? then skey else source.getKey()] = err2

                    if source?
                        sources.push source

                    step i + 1

            step 0

    loadManifests = (keys, callback) ->
        nbKeys = keys.length
        sources = []
        err = {}
        step = (i) ->
            if i >= nbKeys
                callback (if Object.size(err) > 0 then err else null), (if sources.length > 0 then (new CombinedPlayerSource(sources)).setTopLevel() else null)
                return

            tmpErr = []
            key = resolveKey keys[i], '', tmpErr

            if key is ''
                err[keys[i]] = tmpErr
                step i + 1
                return

            loadManifest key, (err2, manifest) ->
                if err2?
                    err[keys[i]] = err2

                if manifest?
                    sources.push manifest

                step i + 1

        step 0

    # exported functions

    exports.loadManifests = loadManifests
    exports.resolveKey = resolveKey
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
