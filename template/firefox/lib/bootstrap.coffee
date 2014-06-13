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

backgroundPage = null
contentScript = null
actionButton = null

url = (page) ->
    self.data.url page

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

startup = ->
    console.error 'Bootstrapping IngressIdentity'

    # start the background page
    console.error 'Creating background page'
    backgroundPage.destroy() if backgroundPage?
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
        for tab in tabs
            if tab.id in workers
                workers[tab.id].port.emit 'iidentity-request-from-background', message

    # start the content scripts
    console.error 'Creating content script'
    contentScript.destroy() if contentScript?
    contentScript = pageMod
        include: [ "https://plus.google.com/*", "https://apis.google.com/*" ]
        contentScriptFile: [ 'vendor/js/jquery.min.js', 'vendor/js/sugar.min.js', 'js/content.js' ].map url
        contentScriptWhen: 'end'
        contentScriptOptions:
            baseURI: url ''
        contentStyleFile: [ url 'css/content.css' ]
        attachTo: [ 'existing', 'top', 'frame' ]
        onAttach: (worker) ->
            workers[worker.tab.id] = worker

            worker.on 'detach', ->
                delete workers[worker.tab.id]

            worker.port.on 'iidentity-request-to-background', createContentScriptMessageListener worker, worker.tab

    # create action button
    console.error 'Creating button'
    actionButton.destroy() if actionButton?
    actionButton = createActionButton
        id: 'iidenitty-show-options'
        label: 'IngressIdentity Options'
        icon:
            '16': url 'img/logo/16.png'
            '32': url 'img/logo/32.png'
            '64': url 'img/logo/64.png'
        onClick: ->
            tabs.open
                url: url 'options.html'
                onReady: (tab) ->
                    console.error 'Attaching options scripts to options.html'
                    worker = tab.attach
                        contentScriptFile: [
                            'vendor/js/jquery.min.js'
                            'vendor/js/jquery-ui.min.js'
                            'vendor/js/sugar.min.js'
                            'vendor/js/bootstrap.min.js'
                            'js/options.js'
                        ].map url

                    worker.port.on 'iidentity-request-to-background', createContentScriptMessageListener worker, tab


try
    startup()
catch e
    console.error e
    console.error e.stack
    throw e
