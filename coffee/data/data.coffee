# Interpret, cache and merge player data.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    exports = if Object.has(module, 'data') then module.data else module.data = {}

    # unexported helper functions and classes

    resolveKey = (key, parent, err) ->
        data = exports.spreadsheets.parseKey key

        if (!Object.isString(data.key) || data.key.isBlank())
            parentData = exports.spreadsheets.parseKey parent

            if (!Object.isString(parentData.key) || parentData.key.isBlank())
                if (err)
                    err.push 'Cannot resolve key ' + key
                return false

            data.key = exports.spreadsheets.parseKey(parent).key

        if (!Object.has data, 'gid')
            return data.key

        '{key}?gid={gid}'.assign data

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
                if (!(Object.isNumber(player.oid) || Object.isString(player.oid)) || ('' + player.oid).match(/^9*$/))
                    return

                newPlayers[player.oid] = player

        hasPlayer: (oid) -> Object.has @players, oid
        getPlayer: (oid) ->
            if (!@hasPlayer oid)
                return null

            exports.interpreter.interpretSourceEntry @data, @players[oid]

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
            self = this

            module.log.log 'Updating source %s', @getKey()
            @spreadsheet.load (err, players) ->
                if (players)
                    module.log.log 'Had %d players, now %d', self.players.length, players.length
                    self.setPlayers players
                    self.setUpdated()

                    if (err)
                        err.each module.log.warn

                    callback true
                else
                    err.each module.log.error

                    callback false

        hasErrors: -> @err.length > 0
        getErrors: -> $.extend {}, @err, @loadingErrors

        hasLoadingErrors: -> !!@loadingErrors
        setLoadingErrors: (err) ->
            if (!err || !Array.isArray err)
                @loadingErrors = null
            else
                @loadingErrors = if err.length == 0 then null else err

        getUrl: -> @spreadsheet.getUrl()

        hasExtra: (tag, oid) -> @data.hasExtra tag, oid

    class ErroredPlayerSource
        constructor: (key, err, data) ->
            @key = key
            @err = err
            @data = data || null

        getKey: @key
        getTag: -> @data && @data.getTag()
        getVersion: -> @data && @data.getVersion()
        getFaction: -> @data && @data.getFaction()

        getNbPlayers: -> 0

        getUrl: -> exports.spreadsheets.keyToUrl @key

        hasErrors: -> true
        getErrors: -> @err

        hasLoadingErrors: -> true
        setLoadingErrors: (err) ->
            if (err)
                this.loadingErrors = err

        hasExtra: -> false

        getTimestamp: -> +new Date
        getUpdateInterval: -> Infinity

        isCombined: -> false

        shouldUpdate: -> false
        setUpdated: ->
        update: (callback) -> callback false

    class CombinedPlayerSource
        constructor: (sources, key, spreadsheet) ->
            @sources = sources

            @key = key || 0
            @spreadsheet = spreadsheet || null

            @cache = {}
            @timestamp = +new Date

            @loadingErrors = null

            @topLevel = false

        setTopLevel: ->
            @topLevel = true
            this

        getKey: -> @key

        hasPlayer: (oid) ->
            if (typeof @cache[oid] != 'undefined')
                return @cache[oid] != null

            @sources.some (source) ->
                source.hasPlayer oid
        getPlayer: (oid) ->
            if Object.has @cache, oid
                return @cache[oid]

            data = [ {} ]
            err = []

            @getSources().each (source) ->
                result = source.getPlayer oid

                if result != null
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
                if (@sources[i].getKey() == key)
                    return @sources[i]

            null

        isCombined: -> true

        invalidateCache: ->
            @getSources().each (source) ->
                if (source.isCombined())
                    source.invalidateCache()

            @cache = {}

        shouldUpdateRemote: (remoteTimestamp) -> remoteTimestamp < @timestamp
        shouldUpdate: -> true
        update: (callback) ->
            origCallback = callback
            self = this
            callback = (updated) ->
                if (updated)
                    @timestamp = +new Date()

                origCallback updated

            if (@spreadsheet)

                module.log.log 'Updating manifest %s', @key
                @spreadsheet.load (err, data) ->
                    length = data.length

                    step = (i, updated) ->
                        if (i >= length)
                            callback updated
                            return

                        source = self.getSource data[i].key
                        if (source == null)
                            loadSource data[i], self.key, (err, source) ->
                                if (source)
                                    module.log.log 'Adding new source sheet %s', data[i].key
                                    self.sources.push source
                                    if (err)
                                        err.each module.log.warn

                                    step i + 1, true
                                else
                                    if (err != null && err.length != 0)
                                        module.log.error 'Error occured while adding source'
                                        err.each module.log.error

                                    step i + 1, updated
                        else
                            if (source.shouldUpdate())
                                if (source.getVersion() != data[i].lastupdated)
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
                    if (i >= length)
                        callback updated
                        return

                    if (self.sources[i].shouldUpdate())
                        self.sources[i].update (u) ->
                            step i + 1, updated || u
                    else
                        step i + 1, updated

                step 0, false

            this

        hasErrors: ->
            @getSources().some (source) ->
                source.hasErrors()
        getErrors: ->
            errors = {}

            @getSources().each (source) ->
                if (source.hasErrors())
                    errors[source.getKey()] = source.getErrors()

            $.extend true, {}, errors, @loadingErrors

        hasLoadingErrors: ->
            !!@loadingErrors || @getSources().some (source) ->
                source.hasLoadingErrors()
        setLoadingErrors: (err) ->
            if (!err || !Array.isArray(err))
                @loadingErrors = null
            else
                @loadingErrors = if err.length == 0 then null else err
                return

            @getSources().each (source) ->
                if (Object.isObject(err) && Object.has(err, source.getKey()))
                    source.setLoadingErrors err[source.getKey()]
                else
                    source.setLoadingErrors null

        getUrl: -> if @spreadsheet then @spreadsheet.getUrl() else null

        getSourcesForExtra: (tag, oid) ->
            result = []

            @getSources().each (source) ->
                if (source.isCombined())
                    result.push source.getSourcesForExtra tag, oid
                else if (source.hasExtra tag, oid)
                    result.push [{
                        url: source.getUrl(),
                        key: source.getTag()
                    }]

            result.reduce (res, elem) ->
                res.concat(elem)
            , []

    loadSource = (data, parentKey, callback) ->
        err = []
        key = resolveKey data.key, parentKey || '', err
        source = new exports.spreadsheets.Source key

        # ignore dummy rows!
        if (key.compact().match /^9+$/)
            callback null, null
            return

        source.load (err2, players) ->
            if (err2 != null)
                err = err.concat err2

            if (players == null)
                callback err, new ErroredPlayerSource(key, err, exports.interpreter.interpretManifestEntry data)
            else
                callback err, new PlayerSource key, source, exports.interpreter.interpretManifestEntry(data), players

    loadManifest = (key, callback) ->
        manifest = new exports.spreadsheets.Manifest key
        sources = []

        manifest.load (merr, sourcesData) ->
            module.log.log 'Loaded manifest ', key, ', got ', sourcesData, 'err: ', merr

            err = {}
            if (merr != null)
                err.__errors = merr

            if (sourcesData == null)
                callback err, new ErroredPlayerSource key, err
                return

            nbSources = sourcesData.length
            step = (i) ->
                if (i >= nbSources)
                    callback((if Object.size(err) > 0 then err else null), new CombinedPlayerSource(sources, key, manifest))
                    return

                skey = sourcesData[i].key

                loadSource sourcesData[i], key, (err2, source) ->
                    if (err2)
                        err[if (source == null) then skey else source.getKey()] = err2

                    if (source != null)
                        sources.push source

                    step i + 1

            step 0

    loadManifests = (keys, callback) ->
        nbKeys = keys.length
        sources = []
        err = {}
        step = (i) ->
            if (i >= nbKeys)
                callback((if Object.size(err) > 0 then err else null), (if (sources.length > 0) then (new CombinedPlayerSource(sources)).setTopLevel() else null))
                return

            key = resolveKey keys[i], '', err

            loadManifest key, (err2, manifest) ->
                if (err2)
                    err[keys[i]] = err2

                if (manifest != null)
                    sources.push manifest

                step i + 1

        step 0

    # exported functions

    exports.loadManifests = loadManifests
    exports.resolveKey = resolveKey
)(window.iidentity = (window.iidentity || {}), window.jQuery)
