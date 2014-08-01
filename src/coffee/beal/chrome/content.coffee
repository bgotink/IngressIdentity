# BEAL file for Google Chrome and Chromium
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, chrome) ->
    exports = module.extension = {}

    exports.sendMessage = (message, callback) ->
        chrome.runtime.sendMessage message, callback

    exports.addMessageListener = (func) ->
        chrome.runtime.onMessage.addListener (request) ->
            # ignore null
            func request if request?
            false

    exports.getLastError = -> chrome.runtime.lastError

    exports.getURL = (rel) ->
        chrome.extension.getURL rel

    exports.getI18nMessage = (name, placeholders = null) ->
        if placeholders?
            chrome.i18n.getMessage name, placeholders
        else
            chrome.i18n.getMessage name

)(iidentity or (iidentity = window.iidentity = {}), window.chrome)
