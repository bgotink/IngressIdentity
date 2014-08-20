# Performs communication with the background page.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    exports = module.comm = {}
    onUpdate = ->
    lastUpdate = +new Date

    exports.send = (request, callback) ->
        request =
            request: request
            lastUpdate: lastUpdate
        lastUpdate = +new Date

        try
            module.extension.sendMessage request, (reply) ->
                    if not reply?
                        module.log.error module.extension.getLastError() if module.extension.getLastError
                        return

                    callback reply.reply if callback?

                    lastUpdate = +new Date
                    if reply.shouldUpdate
                        if onUpdate
                            onUpdate()
        catch e
            # couldn't contact the extension
            # that can only mean one thing: extension has been reloaded, disabled or removed
            # -> reload this page
            window.document.location.reload()

    module.extension.addMessageListener (request) ->
        if request.type is 'update'
            lastUpdate = +new Date

            onUpdate() if onUpdate?

        # ignore: the options page gets all the messages meant for the background
        # page as well... logging/throwing here would fill the console with junk
        false

    exports.hasPlayer = (oid, callback) ->
        @send { type: 'hasPlayer', oid: oid }, (result) ->
            callback result.result

    exports.getPlayer = (oid, callback, extra) ->
        request =
            type: 'getPlayer'
            oid: oid

        if extra?
            request.extra = extra

        @send request, (result) ->
            if result.status isnt 'success'
                callback result.status, null
                return

            callback null, result.player

    exports.setOnUpdate = (callback) -> onUpdate = callback

    exports.getSourcesForExtra = (tag, oid, callback) ->
        @send { type: 'getSourcesForExtra', tag: tag, oid: oid }, (result) ->
            callback result.result

    exports.getTranslationsWithPrefix = (locale, prefix, callback) ->
        @send { type: 'getTranslationsWithPrefix', prefix: prefix, locale: locale }, (result) ->
            callback result.messages

)(iidentity or (iidentity = window.iidentity = {}))
