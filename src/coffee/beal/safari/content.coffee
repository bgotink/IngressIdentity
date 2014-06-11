# BEAL file for Safari
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, safari) ->
    exports = module.extension = {}

    messageCallbacks = Object.extended {}
    messageCallbacks.nextId = 0

    exports.sendMessage = (message, callback) ->
        messageId = '' + ++messageCallbacks.nextId
        messageCallbacks[messageId] = callback

        safari.self.tab.dispatchMessage 'iidentity-request-to-background',
            id: messageId
            message: message

    exports.addMessageListener = (func) ->
        safari.self.addEventListener 'message',
                (event) ->
                    return unless event.name is 'iidentity-request-from-background'

                    func event.message
            , false

    exports.getLastError = null

    exports.getURL = (rel) ->
        safari.extension.baseURI + rel

    exports.init = ->
        safari.self.addEventListener 'message',
                (event) ->
                    return unless event.name is 'iidentity-answer-from-background'

                    callbackId = event.message.id

                    return unless messageCallbacks.has callbackId

                    if event.message.message?
                        messageCallbacks[callbackId](event.message.message)

                    delete messageCallbacks[callbackId]
            , false

)(iidentity or (iidentity = window.iidentity = {}), window.safari)
