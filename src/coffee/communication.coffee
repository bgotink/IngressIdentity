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
                    if typeof reply is 'undefined'
                        module.log.error module.extension.getLastError() if module.extension.getLastError
                        return

                    callback reply.reply

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

            if onUpdate
                onUpdate()

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

        if typeof extra isnt 'undefined' and extra?
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
)(iidentity or (iidentity = window.iidentity = {}))
