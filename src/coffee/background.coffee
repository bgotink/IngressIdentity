# The main background script, containing listeners for communication, aggregating
# the data and storing it.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $, window) ->
    storage = module.extension.storage
    data = null
    exportData = $.Deferred()
    storageCache = null

    isOptionsPage = module.extension.isOptionsPage

    # storage functions

    disableUpdateListener = false
    onDataUpdated = (changes) ->
        update = false
        reload = false

        if disableUpdateListener
            module.log.log 'Chrome storage update listener disabled, re-enabling'
            disableUpdateListener = false
            return

        module.log.log 'Settings updated:'
        changes.each (key) ->
            if storageCache.has key
                storageCache.remove key

            module.log.log '- %s', key

            if key is 'manifest_keys'
                reload = true
            else
                update = true

        if reload
            module.log.log 'Reloading manifests'
            reloadData (err, reloaded) ->
                if reloaded
                    module.log.log 'Manifests reloaded'

                    if err
                        err.each module.log.warn
                else
                    module.log.error 'Error when reloading manifest:'
                    err.each module.log.error
        else if update
            module.log.log 'Updating tabs'
            updateTabs()

    getStoredData = (key, defaultValue, callback) ->
        request = {}
        request[key] = defaultValue

        if storageCache.has key
            result = storageCache.get key

            module.log.log 'Got storage { key: %s, value: %s } from storage cache', key, '' + result
            callback result
        else
            storage.get request, (result) ->
                module.log.log 'Got storage { key: %s, value: %s } from storage', key, '' + result[key]

                storageCache.set key, result[key]
                callback result[key]

    setStoredData = (key, value, callback) ->
        request = {}
        request[key] = value

        module.log.log 'Setting storage key %s to %s', key, '' + value
        storage.set request, ->
            storageCache.remove key

            callback()

    setStoredDatas = (data, callback) ->
        module.log.log 'Settings multiple storage values:', data
        storage.set data, ->
            Object.each data, (key) ->
                storageCache.remove key

            callback()

    getManifestKeys = (callback) ->
        module.log.log 'Fetching manifest keys...'
        storage.get { manifest_keys: [] }, (result) ->
            callback result.manifest_keys.map (e) ->
                module.data.resolveKey e, ''

    setManifestKeys = (keys, callback) ->
        module.log.log 'Setting manifest keys...'
        storage.set { manifest_keys: keys }, callback

    addManifestKey = (key, name, callback) ->
        getManifestKeys (keys) ->
            key = key.compact()

            unless keys.none key
                module.log.log 'manifest key %s already loaded', key
                callback false
                return

            module.log.log 'adding manifest key %s', key
            keys.push key

            setManifestKeys keys, ->
                if not Object.isString(name) or name.isBlank()
                    callback true
                    return

                getStoredData 'manifest_names', {}, (names) ->
                    names[key] = name.compact()

                    setStoredData 'manifest_names', names, ->
                        callback true

    removeManifestKey = (key, callback) ->
        getManifestKeys (keys) ->
            if keys.none key
                callback false
                return

            keys.remove key

            setManifestKeys keys, ->
                callback true

    renameManifest = (key, oldName, newName, callback) ->
        if (not Object.isString(oldName) or oldName.isBlank()) and (not Object.isString(newName) or newName.isBlank())
            callback true
            return

        if ('' + oldName).compact() is ('' + newName).compact()
            callback true
            return

        getStoredData 'manifest_names', {}, (names) ->
            if Object.isString(oldName) and not oldName.isBlank()
                if not Object.has(names, key) or names[key] isnt oldName
                    callback false
                    return
            else
                if Object.has(names, key) and not names[key].isBlank()
                    callback false
                    return

            if Object.isString(newName) and not newName.isBlank()
                names[key] = newName.compact()
            else
                delete names[key]

            setStoredData 'manifest_names', names, ->
                storageCache.remove 'manifests'

                callback true

    changeManifestOrder = (oldOrder, newOrder, callback) ->
        getManifestKeys (currentOrder) ->
            length = currentOrder.length

            if oldOrder.length isnt length or newOrder.length isnt length
                callback 'failed'
                return

            # check if old order is still correct
            for i in [0..length-1]
                if oldOrder[i] isnt currentOrder[i]
                    callback 'failed'
                    return

            # check if the keys in the old one are still in the new one
            # and if the keys of the new one are also in the old one
            for i in [0..length-1]
                if oldOrder.none(newOrder[i]) or newOrder.none(oldOrder[i])
                    callback 'failed'
                    return

            # set new order
            setManifestKeys newOrder, ->
                callback 'success'

    # data functions

    reloadData = (callback) ->
        getManifestKeys (storedData) ->
            module.data.loadManifests storedData, (err, newData) ->
                if newData?
                    data = newData
                    data.setLoadingErrors err

                    storageCache.remove 'manifests'

                    updateTabs()
                    callback null, (if data.hasLoadingErrors() then 'warning' else 'success')
                else
                    callback err, 'failed'

    #communication functions

    updateTabs = ->
        module.extension.sendToTabs
            type: 'update'

    messageListeners =
        getManifests: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'getManifests\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            if storageCache.has 'manifests'
                module.log.log 'Requesting manifests, loaded from cache'
                sendResponse storageCache.get 'manifests'

                return false

            module.log.log 'Requesting manifests, loading from source'
            getManifestKeys (keys) ->
                getStoredData 'manifest_names', {} , (names) ->
                    result = {}

                    module.log.log 'Loaded manifests: ', keys

                    unless data?
                        module.log.log 'Data not loaded, yet, returning empty reply'
                        sendResponse {}

                        return false

                    keys.each (key) ->
                        manifest = data.getSource key
                        manifestData = []

                        unless manifest?
                            module.log.error 'Strangely manifest %s cannot be found', key
                        else if manifest.isCombined()
                            manifest.getSources().each (source) ->
                                tmp =
                                    key:     source.getKey()
                                    tag:     source.getTag()
                                    count:   source.getNbPlayers()
                                    version: source.getVersion()
                                    faction: source.getFaction()

                                if (source.getUrl() != null)
                                    tmp.url = source.getUrl()

                                manifestData.push tmp

                        module.log.log 'Manifest %s contains the following data:', key
                        module.log.log manifestData

                        result[key] =
                            name: if Object.has names, key then names[key] else null
                            sources: manifestData
                            url : if manifest then manifest.getUrl() else null

                    storageCache.set 'manifests', result

                    module.log.log 'Sending result to getManifests: ', result
                    sendResponse result

            true

        getManifestErrors: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'getManifestErrors\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            if data?
                errors = data.getErrors()

                module.log.log 'Sending manifest errors', errors
                sendResponse errors
            else
                sendResponse {}

            false

        addManifest: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'An \'addManifest\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            disableUpdateListener = true
            addManifestKey request.key, request.name, (added) ->
                unless added
                    disableUpdateListener = false
                    sendResponse { status: 'duplicate' }
                    return

                reloadData (err, status) ->
                    disableUpdateListener = false
                    sendResponse { status: status, err: err }

            true

        removeManifest: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'removeManifest\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            disableUpdateListener = true
            removeManifestKey request.key, (removed) ->
                unless removed
                    disableUpdateListener = false
                    sendResponse { status: 'nonexistent' }
                    return

                reloadData (err, status) ->
                    disableUpdateListener = false
                    sendResponse { status: status, err: err }

            true

        renameManifest: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'renameManifest\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            module.log.log 'Renaming manifest ', request.key, ' from ', request.oldName, ' to ', request.newName
            renameManifest request.key, request.oldName, request.newName, (status) ->
                sendResponse { status: if status then 'success' else 'failed' }

            true

        changeManifestOrder: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'changeManifestOrder\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            module.log.log 'Requesting to change order from ', request.oldOrder, ' to ', request.newOrder
            changeManifestOrder request.oldOrder, request.newOrder, (status) ->
                sendResponse { status: status }

            true

        reloadData: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'reloadData\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            reloadData (err, status) ->
                sendResponse { status: status, err: err }

            true

        setOptions: (request, sender, sendResponse) ->
            unless isOptionsPage sender.url
                module.log.error 'A \'setOptions\' message can only originate from the options page'
                module.log.error 'Not from %s', sender.url
                # silently die by not sending a response
                return false

            options = {}
            sentOptions = request.options

            [ 'match', 'show' ].each (attr) ->
                if Object.has sentOptions, attr
                    Object.each sentOptions[attr], (key, value) ->
                        options['option-' + attr + '-' + key] = value

            if Object.has sentOptions, 'own-oid'
                options['option-own-oid'] = sentOptions['own-oid']

            setStoredDatas options, ->
                data?.invalidateCache()
                updateTabs()
                sendResponse { result: request.value }

            true

        getOption: (request, sender, sendResponse) ->
            getStoredData 'option-' + request.option, request.defaultValue, (result) ->
                sendResponse { value: result }

            true

        hasPlayer: (request, sender, sendResponse) ->
            if data?
                sendResponse
                    result: data.hasPlayer request.oid
            else
                sendResponse
                    result: false

            false

        getSourcesForExtra: (request, sender, sendResponse) ->
            if data?
                getStoredData 'option-show-sources', true, (match) ->
                    if match
                        sendResponse
                            result: data.getSourcesForExtra request.tag, request.oid
                    else
                        sendResponse
                            result: []
            else
                sendResponse
                    result: []

            true

        getPlayer: (request, sender, sendResponse) ->
            unless data?
                sendResponse { status: 'not-found' }
                return false

            doGetPlayer = ->
                player = data.getPlayer request.oid

                unless player?
                    sendResponse { status: 'not-found' }
                    return

                if Object.has player.extra, 'anomaly'
                    getStoredData 'option-show-anomalies', true, (showAnomalies) ->
                        unless showAnomalies
                            delete player.extra.anomaly

                        sendResponse { status: 'success', player: player }
                else
                    sendResponse { status: 'success', player: player }

            checkForSelf = ->
                if Object.has(request, 'extra') and Object.has(request.extra, 'show_self') and request.extra.show_self
                    doGetPlayer()
                    return

                getStoredData 'option-show-hide-self', false, (hide) ->
                    if hide
                        # user wants to hide his/her own oid
                        getStoredData 'option-own-oid', '', (foundOid) ->
                            if foundOid is request.oid
                                # this is the user
                                sendResponse { status: 'not-found' }
                            else
                                doGetPlayer()
                    else
                        doGetPlayer()

            if not Object.has(request, 'extra') or not Object.has(request.extra, 'match')
                checkForSelf()
                return true

            getStoredData 'option-match-' + request.extra.match, true, (doMatch) ->
                unless doMatch
                    sendResponse { status: 'not-found' }
                    return

                checkForSelf()

            true

        getTranslationsWithPrefix: (request, sender, sendResponse) ->
            module.i18n.getPrefixedMessages request.locale,
                request.prefix,
                (messages) ->
                    sendResponse
                        messages: messages

            true

        setExportData: (request, sender, sendResponse) ->
            module.log.log 'Set export data to ', request.data
            exportData.resolve request.data

            # send a response to allow the client to execute after this call
            # has been completed
            sendResponse
                status: 'success'

            # we've already sent our response
            false

        getExportData: (request, sender, sendResponse) ->
            exportData.done (data) ->
                module.log.log 'Returning export data ', data
                sendResponse
                    data: data

                # reset the deferred object
                exportData = $.Deferred()

            true

        find: (request, sender, sendResponse) ->
            module.log.log 'Trying to find', request.pattern

            if data?
                sendResponse
                    data: data.find request.pattern
            else
                sendResponse
                    data: []

            false

        shouldShowExport: (request, sender, sendResponse) ->
            sent = false

            getStoredData 'option-show-export', true, (show) ->
                sent = true
                sendResponse { value: show }

            !sent

    module.extension.addMessageListener (request, sender, sendResponse) ->
        reply = null

        if request.lastUpdate
            reply = {}

            realRequest = request.request
        else
            realRequest = request

        if sender.tab
            module.log.log 'Got "%s" request from tab %s, url: %s', realRequest.type, sender.tab.id, sender.url
        else
            module.log.error 'Got request from this backgroundpage?'
            # silently ignore
            return

        if Object.has messageListeners, realRequest.type
            messageListeners[realRequest.type] realRequest, sender, (response) ->
                if reply?
                    reply.reply = response
                    reply.shouldUpdate = if data == null then false else data.shouldUpdateRemote request.lastUpdate
                else
                    reply = response

                sendResponse reply
        else
            module.log.error 'Unknown message type: %s', realRequest.type
            module.log.error 'Request: ', realRequest
            module.log.error 'Sender: ', sender

            false

    initGoogle = ->
        return if google?

        $.getScript 'https://www.google.com/jsapi'
            .fail ->
                module.log.error 'Failed to load the Google API, trying again in 20 seconds'
                setTimeout initGoogle, 20 * 1000
            .done ->
                google.load 'visualization', '1',
                    callback: ->
                        reloadData (err, success) ->
                            if success
                                module.log.log 'Successfully loaded existing configuration'
                                if err
                                    err.each module.log.warn
                            else
                                module.log.error 'Something went wrong while loading existing configuration'
                                err.each module.log.error

                        window.setInterval ->
                            return unless data?

                            module.log.log 'Performing hourly update...'
                            data.update (updated) ->
                                if updated
                                    data.invalidateCache()

                                    storageCache.remove 'manifests'

                                    updateTabs()
                        , 60 * 60 * 1000


    $ ->
        module.extension.init() if module.extension.init?

        storageCache = new module.Cache()

        initGoogle()

        module.extension.addDataChangedListener onDataUpdated

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
