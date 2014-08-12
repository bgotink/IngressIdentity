# BEAL file for Safari
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, safari, localStorage) ->
    exports = module.extension = {}

    settings = safari.extension.settings
    exports.storage =
        get: (data, callback) ->
            callback Object.map data, (key, defaultValue) ->
                settings[key] or defaultValue

        set: (data, callback) ->
            Object.each data, (key, value) ->
                settings[key] = value
            callback()

    optionsPageRegExp = new RegExp RegExp.escape(safari.extension.baseURI + 'options.html') + '.*'
    exports.isOptionsPage = (url) ->
        !!url.match optionsPageRegExp

    exports.getURL = (rel) ->
        safari.extension.baseURI + rel

    exports.sendToTabs = (message) ->
        total = 0
        sent = 0

        safari.application.browserWindows.each (safariWindow) ->
            safariWindow.tabs.each (tab) ->
                total++

                if tab.page? and tab.url?
                    tab.page.dispatchMessage 'iidentity-request-from-background', message
                    sent++

        module.log.log 'Sent a message to %d of %d tabs', sent, total

    exports.addMessageListener = (func) ->
        safari.application.addEventListener 'message', (event) ->
                return unless event.name is 'iidentity-request-to-background'

                realSender = event.target
                sender =
                    url: realSender.url
                    tab:
                        # not really an ID, but whatever, only used for debugging
                        # anyway
                        id: realSender.title

                realMessage = event.message
                return unless Object.has(realMessage, 'id') and Object.has(realMessage, 'message')
                message = realMessage.message

                sendResponse = ( ->
                    called = false
                    (msg) ->
                        # only allow one response to be sent
                        return if called
                        called = true

                        realSender.page.dispatchMessage 'iidentity-answer-from-background',
                            message: msg
                            id: realMessage.id
                )()

                try
                    func message, sender, sendResponse
                catch e
                    sendResponse null
                    throw e
            , false

    exports.addDataChangedListener = ->
        # not implemented: safari doesn't support syncing extension data
        # between different safari installations

    exports.init = ->
        safari.application.addEventListener 'command', (event) ->
                return unless event.command is 'show-options-page'

                tab = event.target.browserWindow.openTab 'foreground'
                tab.url = safari.extension.baseURI + 'options.html'
            , false

)(iidentity or (iidentity = window.iidentity = {}), window.safari, window.localStorage)
