# BEAL file for Google Chrome and Chromium
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, chrome) ->
    exports = module.extension = {}

    exports.storage = chrome.storage.sync

    exports.isOptionsPage = (url) ->
        !!url.match new RegExp 'chrome-extension:\\/\\/' + chrome.runtime.id + '/options.html.*'

    exports.sendToTabs = (message) ->
        chrome.tabs.query {}, (tabs) ->
            module.log.log 'Sending update message to %d tabs', tabs.length

            tabs.each (tab) ->
                module.log.log '-- tab ', tab
                chrome.tabs.sendMessage tab.id, message

    exports.addMessageListener = (func) ->
        chrome.runtime.onMessage.addListener func

    exports.addDataChangedListener = (listener) ->
        chrome.storage.onChanged.addListener (changes) ->
            listener Object.keys changes

)(iidentity or (iidentity = window.iidentity = {}), window.chrome)
