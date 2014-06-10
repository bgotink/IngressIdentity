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
            func request
            false

    exports.getLastError = -> chrome.runtime.lastError

    exports.getURL = (rel) ->
        chrome.extension.getURL(rel)

)(iidentity or (iidentity = window.iidentity = {}), window.chrome)
