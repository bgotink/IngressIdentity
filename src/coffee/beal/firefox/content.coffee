# BEAL file for Firefox
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    exports = module.extension = {}

    # firefox does something weird with objects being sent through
    # e.g.: arrays have length undefined, prototype is _not_ correct etc
    clone = (e) ->
        if typeof e is 'object'
            Object.clone e, true
        else if typeof e is 'array'
            Array.clone e, true
        else if typeof e is 'string'
            '' + e
        else
            e

    addon = window.addon or self

    messageCallbacks = Object.extended {}
    messageCallbacks.nextId = 0

    exports.sendMessage = (message, callback) ->
        messageId = '' + ++messageCallbacks.nextId
        messageCallbacks[messageId] = callback

        addon.port.emit 'iidentity-request-to-background',
            id: messageId
            message: message

    exports.addMessageListener = (func) ->
        addon.port.on 'iidentity-request-from-background', func

    exports.getLastError = null

    exports.getURL = (rel) ->
        # this doesn't work with addon :-/
        self.options.baseURI + rel

    exports.browser = 'firefox'

    exports.init = ->
        addon.port.on 'iidentity-answer-from-background', (message) ->
                callbackId = message.id

                return unless messageCallbacks.has callbackId

                if message.message?
                    messageCallbacks[callbackId] clone message.message

                delete messageCallbacks[callbackId]

)(iidentity or (iidentity = window.iidentity = {}))
