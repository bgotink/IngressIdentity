# The main background script, containing listeners for communication, aggregating
# the data and storing it.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $, window) ->
    storage = chrome.storage.sync
    data = null
    storageCache = {}

    isOptionsPage = (url) ->
        !!url.match new RegExp('chrome-extension:\\/\\/' + chrome.runtime.id + '/options.html.*')

    # storage functions

    disableUpdateListener = false
    onDataUpdated = (changes) ->
        update = false
        reload = false

        if (disableUpdateListener)
            module.log.log 'Chrome storage update listener disabled, re-enabling'
            disableUpdateListener = false
            return

        module.log.log 'Settings updated:'
        Object.each changes, (key) ->
            if (Object.has storageCache, key)
                delete storageCache[key]

            module.log.log '- %s', key

            if (key == 'manifest_keys')
                reload = true
            else
                update = true

        if (reload)
            module.log.log 'Reloading manifests'
            reloadData (err, reloaded) ->
                if (reloaded)
                    module.log.log 'Manifests reloaded'

                    if (err)
                        err.each module.log.warn
                else
                    module.log.error 'Error when reloading manifest:'
                    err.each module.log.error
        else if (update)
            module.log.log 'Updating tabs'
            updateTabs()

    getStoredData = (key, defaultValue, callback) ->
        request = {}
        request[key] = defaultValue

        if (Object.has(storageCache, key) && storageCache[key].expires > (+new Date))
            module.log.log 'Got storage { key: %s, value: %s } from storage cache', key, '' + storageCache[key].result
            callback storageCache[key].result
        else
            storage.get request, (result) ->
                module.log.log 'Got storage { key: %s, value: %s } from storage', key, '' + result[key]

                storageCache[key] =
                    result: result[key]
                    expires: (+new Date()) + 60 * 1000
                callback result[key]

    setStoredData = (key, value, callback) ->
        request = {}
        request[key] = value

        module.log.log 'Setting storage key %s to %s', key, '' + value
        storage.set request, callback

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

            if (!keys.none key)
                module.log.log 'manifest key %s already loaded', key
                callback false
                return

            module.log.log 'adding manifest key %s', key
            keys.push key

            setManifestKeys keys, ->
                if (!Object.isString(name) || name.isBlank())
                    callback true
                    return

                getStoredData 'manifest_names', {}, (names) ->
                    names[key] = name.compact()

                    setStoredData 'manifest_names', names, ->
                        callback true

    removeManifestKey = (key, callback) ->
        getManifestKeys (keys) ->
            if (keys.none key)
                callback false
                return

            keys.remove key

            setManifestKeys keys, ->
                callback true

    renameManifest = (key, oldName, newName, callback) ->
        if ((!Object.isString(oldName) || oldName.isBlank()) && (!Object.isString(newName) || newName.isBlank()))
            callback true
            return

        if (('' + oldName).compact() == ('' + newName).compact())
            callback true
            return

        getStoredData 'manifest_names', {}, (names) ->
            if (Object.isString(oldName) && !oldName.isBlank())
                if (!Object.has(names, key) || names[key] != oldName)
                    callback false
                    return
            else
                if (Object.has(names, key) && !names[key].isBlank())
                    callback false
                    return

            if (Object.isString(newName) && !newName.isBlank())
                names[key] = newName.compact()
            else
                delete names[key]

            setStoredData 'manifest_names', names, ->
                if (Object.has storageCache, 'manifest_names')
                    delete storageCache.manifest_names
                if (Object.has storageCache, 'manifests')
                    delete storageCache.manifests

                callback true

    changeManifestOrder = (oldOrder, newOrder, callback) ->
        getManifestKeys (currentOrder) ->
            length = currentOrder.length

            if (oldOrder.length != length || newOrder.length != length)
                callback 'failed'
                return

            # check if old order is still correct
            for i in [0..length-1]
                if (oldOrder[i] != currentOrder[i])
                    callback 'failed'
                    return

            # check if the keys in the old one are still in the new one
            # and if the keys of the new one are also in the old one
            for i in [0..length-1]
                if (oldOrder.none(newOrder[i]) || newOrder.none(oldOrder[i]))
                    callback 'failed'
                    return

            # set new order
            setManifestKeys newOrder, ->
                callback 'success'

    # data functions

    reloadData = (callback) ->
        getManifestKeys (storedData) ->
            module.data.loadManifests storedData, (err, newData) ->
                if (newData != null)
                    data = newData
                    data.setLoadingErrors err

                    if (Object.has storageCache, 'manifests')
                        delete storageCache.manifests

                    updateTabs()
                    callback null, (if data.hasLoadingErrors() then 'warning' else 'success')
                else
                    callback err, 'failed'

    #communication functions

    updateTabs = ->
        chrome.tabs.query {}, (tabs) ->
            message =
                type: 'update'
            module.log.log 'Sending update message to %d tabs', tabs.length

            tabs.each (tab) ->
                module.log.log '-- tab ', tab
                chrome.tabs.sendMessage tab.id, message

    messageListeners =
        getManifests: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'getManifests\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            if (Object.has storageCache, 'manifests')
                module.log.log 'Requesting manifests, loaded from cache'
                sendResponse storageCache.manifests

                return false

            module.log.log 'Requesting manifests, loading from source'
            getManifestKeys (keys) ->
                getStoredData 'manifest_names', {} , (names) ->
                    result = {}

                    module.log.log 'Loaded manifests: ', keys

                    if (data == null)
                        module.log.log 'Data not loaded, yet, returning empty reply'
                        sendResponse {}

                        return false

                    keys.each (key) ->
                        manifest = data.getSource key
                        manifestData = []

                        if (manifest == null)
                            module.log.error 'Strangely manifest %s cannot be found', key
                        else if (manifest.isCombined())
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

                    storageCache.manifests = result;

                    module.log.log 'Sending result to getManifests: ', result
                    sendResponse result

            true

        getManifestErrors: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'getManifestErrors\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            if (data == null)
                sendResponse {}
            else
                sendResponse data.getErrors()

            false

        addManifest: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'An \'addManifest\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            disableUpdateListener = true
            addManifestKey request.key, request.name, (added) ->
                if (!added)
                    disableUpdateListener = false
                    sendResponse { status: 'duplicate' }
                    return

                reloadData (err, status) ->
                    disableUpdateListener = false
                    sendResponse { status: status, err: err }

            true

        removeManifest: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'removeManifest\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            disableUpdateListener = true
            removeManifestKey request.key, (removed) ->
                if (!removed)
                    disableUpdateListener = false
                    sendResponse { status: 'nonexistent' }
                    return

                reloadData (err, status) ->
                    disableUpdateListener = false
                    sendResponse { status: status, err: err }

            true

        renameManifest: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'renameManifest\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            module.log.log 'Renaming manifest ', request.key, ' from ', request.oldName, ' to ', request.newName
            renameManifest request.key, request.oldName, request.newName, (status) ->
                sendResponse { status: status ? 'success' : 'failed' }

            true

        changeManifestOrder: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'changeManifestOrder\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            module.log.log 'Requesting to change order from ', request.oldOrder, ' to ', request.newOrder
            changeManifestOrder request.oldOrder, request.newOrder, (status) ->
                sendResponse { status: status }

            true

        reloadData: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'reloadData\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            reloadData (err, status) ->
                sendResponse { status: status, err: err }

            true

        setOption: (request, sender, sendResponse) ->
            if (!isOptionsPage sender.url)
                module.log.error 'A \'setOption\' message can only originate from the options page'
                # silently die by not sending a response
                return false

            setStoredData 'option-' + request.option, request.value, ->
                data.invalidateCache()
                updateTabs()
                sendResponse { result: request.value }

            true

        getOption: (request, sender, sendResponse) ->
            getStoredData 'option-' + request.option, request.defaultValue, (result) ->
                sendResponse { value: result }

            true

        hasPlayer: (request, sender, sendResponse) ->
            if (data == null)
                sendResponse { result: false }
            else
                sendResponse { result: data.hasPlayer request.oid }

            false

        getSourcesForExtra: (request, sender, sendResponse) ->
            if (data == null)
                sendResponse { result: [] }
            else
                getStoredData 'option-match-extra-' + request.tag, true, (match) ->
                    if (!match)
                        sendResponse { result: [] }
                    else
                        sendResponse { result: data.getSourcesForExtra request.tag, request.oid }

            true

        getPlayer: (request, sender, sendResponse) ->
            if (data == null)
                sendResponse { status: 'not-found' }
                return false
            doGetPlayer = ->
                player = data.getPlayer request.oid

                if (player == null)
                    sendResponse { status: 'not-found' }

                    return false

                if (Object.has player.extra, 'anomaly')
                    getStoredData 'option-show-anomalies', true, (showAnomalies) ->
                        if (!showAnomalies)
                            delete player.extra.anomaly

                        sendResponse { status: 'success', player: player }

                    return true

                sendResponse { status: 'success', player: player }

                return false

            if (!Object.has(request, 'extra') || !Object.has(request.extra, 'match'))
                return doGetPlayer()

            getStoredData 'option-match-' + request.extra.match, true, (doMatch) ->
                if (!doMatch)
                    sendResponse { status: 'not-found' }
                    return

                doGetPlayer()

            true

    chrome.runtime.onMessage.addListener (request, sender, sendResponse) ->
        if (sender.tab)
            module.log.log 'Got request from tab %s, url: %s', sender.tab.id, sender.url
        else
            module.log.error 'Got request from this backgroundpage?'
            # silently ignore
            return

        reply = null

        if (request.lastUpdate)
            reply = {}

            realRequest = request.request
        else
            realRequest = request

        if (Object.has messageListeners, realRequest.type)
            messageListeners[realRequest.type] realRequest, sender, (response) ->
                if (reply != null)
                    reply.reply = response
                    reply.shouldUpdate = if data == null then false else data.shouldUpdateRemote request.lastUpdate
                else
                    reply = response

                sendResponse reply
        else
            module.log.error 'Unknown message type: %s', request.type
            module.log.error 'Request: ', request
            module.log.error 'Sender: ', sender

            false

    $ ->
        google.load 'visualization', '1', {
            callback: ->
                reloadData (err, success) ->
                    if (success)
                        module.log.log 'Successfully loaded existing configuration'
                        if (err)
                            err.each module.log.warn
                    else
                        module.log.error 'Something went wrong while loading existing configuration'
                        err.each module.log.error

                window.setInterval ->
                    if (data == null)
                        return

                    module.log.log 'Performing hourly update...'
                    data.update (updated) ->
                        if (updated)
                            data.invalidateCache()

                            if (Object.has storageCache, 'manifests')
                                delete storageCache.manifests

                            updateTabs()
                , 60 * 60 * 1000
        }

        chrome.storage.onChanged.addListener onDataUpdated

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
