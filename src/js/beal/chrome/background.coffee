# BEAL file for Google Chrome and Chromium
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, chrome) ->
    exports = module.extension = {}
    storage = chrome.storage.sync

    optionsPage = 'chrome-extension://' + chrome.runtime.id + '/options.html'

    exports.storage =
        get: (data, callback) ->
            storage.get data, callback
        set: (data, callback) ->
            storage.set data, callback

    optionsPageRegExp = new RegExp RegExp.escape(optionsPage) + '.*'
    exports.isOptionsPage = (url) ->
        !!url.match optionsPageRegExp

    exports.getURL = (rel) ->
        chrome.extension.getURL rel

    exports.sendToTabs = (message) ->
        chrome.tabs.query {}, (tabs) ->
            module.log.log 'Sending update message to %d tabs', tabs.length

            tabs.each (tab) ->
                module.log.log '-- tab ', tab
                chrome.tabs.sendMessage tab.id, message

    exports.addMessageListener = (func) ->
        chrome.runtime.onMessage.addListener (request, sender, sendResponse) ->
            try
                func request, sender, sendResponse
            catch e
                sendResponse null
                throw e

    exports.addDataChangedListener = (listener) ->
        chrome.storage.onChanged.addListener (changes) ->
            listener Object.keys changes

    exports.init = ->
        chrome.browserAction.onClicked.addListener (tab) ->
            chrome.tabs.create
                url: optionsPage
                active: true
                openerTabId: tab.id

)(iidentity or (iidentity = window.iidentity = {}), window.chrome)
