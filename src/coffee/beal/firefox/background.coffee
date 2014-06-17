# BEAL file for Safari
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    exports = module.extension = {}

    exports.storage =
        get: (data, callback) ->
            callback Object.map data, (key, defaultValue) ->
                value = localStorage[key]
                try
                    if value? then JSON.parse(value) else defaultValue
                catch e
                    module.log.error 'Error when parsing localStorage.%s as JSON: ', key, e
                    delete localStorage[key]
                    defaultValue

        set: (data, callback) ->
            Object.each data, (key, value) ->
                localStorage[key] = JSON.stringify value
            callback()

    optionsPageRegExp = new RegExp '.*' + RegExp.escape('options.html') + '.*'
    exports.isOptionsPage = (url) ->
        !!url.match new RegExp optionsPageRegExp

    exports.sendToTabs = (message) ->
        addon.port.emit 'iidentity-request-from-background', message

    exports.addMessageListener = (func) ->
        addon.port.on 'iidentity-request-to-background', (message) ->
            return unless Object.has(message, 'id') and Object.has(message, 'message') and Object.has(message, 'sender')

            reply =
                id: message.id

            request = message.message
            sender = message.sender

            sent = false
            sendReply = (repl) ->
                return if sent
                sent = true

                reply.reply = repl
                addon.port.emit 'iidentity-answer-from-background', reply

            try
                func request, sender, sendReply
            catch e
                sendReply null
                throw e

    exports.addDataChangedListener = ->
        # not implemented: not available in the firefox API

    exports.init = ->
        addon.port.once 'iidentity-base-uri', (message) ->
            module.log.log 'baseURI = %s', message.uri
            optionsPageRegExp = new RegExp RegExp.escape(message.uri + 'options.html') + '.*'

        addon.port.emit 'iidentity-background-ready'

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
