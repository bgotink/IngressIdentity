# Main script for firefox add-on
#
# Creates a background page and content script when starting
# the add-on, and destroys these when shutting the add-on
# down.
# Routes the messages between background page and tabs.
# Registers a button in the UI to open the options page.
#
# @author Bram Gotink (@bgotink)
# @license MIT

self = require 'sdk/self'
pageMod = require 'sdk/page-mod'
    .PageMod
pageWorker = require 'sdk/page-worker'
    .Page
tabs = require 'sdk/tabs'
createActionButton = require 'sdk/ui/button/action'
    .ActionButton
web_resources = require './resources'

backgroundPage = null
contentScript = null
exportScript = null
optionsScript = null
optionsTab = null
actionButton = null

url = (page) ->
    self.data.url page

web_url = (page) ->
    web_resources.url page

callbacks =
    nextId: 0

workers = {}

array_remove = (arry, elem) ->
    i = array.indexOf elem
    array.slice i, 1 if i isnt -1

createContentScriptMessageListener = (sender, tab) ->
    (message) ->
        originalCallbackId = message.id
        message.id = '' + ++callbacks.nextId

        callbacks[message.id] = (reply) ->
            sender.port.emit 'iidentity-answer-from-background',
                id: originalCallbackId
                message: reply

        message.sender =
            url: tab.url
            tab:
                id: tab.id

        backgroundPage.port.emit 'iidentity-request-to-background', message

exports.main = ->
    console.log 'Bootstrapping IngressIdentity'

    # start the background page
    console.log 'Creating background page'
    backgroundPage = pageWorker
        contentURL: url 'background.html'
    backgroundPage.port.on 'iidentity-background-ready', ->
        console.log 'Background page is initialized, sending BaseURI %s', url ''
        backgroundPage.port.emit 'iidentity-base-uri',
            uri: url ''
    backgroundPage.port.on 'iidentity-answer-from-background', (reply) ->
        callback = callbacks[reply.id]
        delete callbacks[reply.id]

        callback reply.reply
    backgroundPage.port.on 'iidentity-request-from-background', (message) ->
        console.log 'Forwarding message to tabs'
        for tab in tabs
            if workers[tab.id]?
                console.log '-- tab', tab.id
                workers[tab.id].port.emit 'iidentity-request-from-background', message

    # start the content scripts
    console.log 'Creating content scripts'
    contentScript = pageMod
        include: [ "https://plus.google.com/*", "https://apis.google.com/*" ]
        contentScriptFile: [ 'vendor/js/jquery.min.js', 'vendor/js/sugar.min.js', 'js/content.js' ].map url
        contentScriptWhen: 'end'
        contentScriptOptions:
            baseURI: web_url ''
        contentStyleFile: [ url 'css/content.css' ]
        attachTo: [ 'existing', 'top', 'frame' ]
        onAttach: (worker) ->
            tabId = worker.tab.id
            workers[tabId] = worker

            worker.on 'detach', ->
                delete workers[tabId]

            worker.port.on 'iidentity-request-to-background', createContentScriptMessageListener worker, worker.tab

    # create script for export page
    exportScript = pageMod
        include: [ web_url 'export.html' ]
        contentScriptFile: [ 'vendor/js/jquery.min.js', 'vendor/js/jquery-ui.min.js', 'vendor/js/sugar.min.js', 'vendor/js/bootstrap.min.js', 'js/export.js' ].map url
        contentScriptWhen: 'end'
        contentScriptOptions:
            baseURI: web_url ''
        attachTo: [ 'existing', 'frame' ]
        onAttach: (worker) ->
            worker.port.on 'iidentity-request-to-background', createContentScriptMessageListener worker, worker.tab

    # create script for options page
    optionsScript = pageMod
        include: [ url 'options.html' ]
        contentScriptFile: [
                'vendor/js/jquery.min.js'
                'vendor/js/jquery-ui.min.js'
                'vendor/js/sugar.min.js'
                'vendor/js/bootstrap.min.js'
                'js/options.js'
            ].map url
        contentScriptWhen: 'end'
        contentScriptOptions:
            baseURI: url ''
        attachTo: [ 'existing', 'top' ]
        onAttach: (worker) ->
            tabId = worker.tab.id
            workers[tabId] = worker

            worker.on 'detach', ->
                delete workers[tabId]

            worker.port.on 'iidentity-request-to-background', createContentScriptMessageListener worker, worker.tab

    # create action button
    console.log 'Creating button'
    actionButton = createActionButton
        id: 'iidenitty-show-options'
        label: 'IngressIdentity Options'
        icon:
            '16': url 'img/logo/16.png'
            '32': url 'img/logo/32.png'
            '64': url 'img/logo/64.png'
        onClick: ->
            if optionsTab?
                optionsTab.activate()
                return

            tabs.open
                url: url 'options.html'

exports.onUnload = ->
    console.log 'Unloading add-on...'

    console.log 'Destroying the action button'
    actionButton?.destroy()

    if optionsTab?
        console.log 'Closing options page'
        optionsTab.close()
        optionsTab = null

    console.log 'Destroying content scripts'
    contentScript?.destroy()
    exportScript?.destroy()
    optionsScript?.destroy()

    console.log 'Destroying background page'
    backgroundPage?.destroy()

    console.log 'Clearing data'
    callbacks =
        nextId: 0

    workers = {}

    console.log 'Add-on unloaded'
