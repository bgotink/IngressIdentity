---
---

$ ->
    if chrome?
        if chrome.app.isInstalled
            $ '.chrome.not-installed'
                .removeClass 'hide'
            $ '.chrome.installed'
                .addClass 'hide'
        else
            $ '.chrome.install'
                .on 'click', ->
                    chrome.webstore.install()
    else
        console.log 'Not Google Chrome'
        $ '.not-chrome'
            .removeClass 'hide'
        $ '.chrome'
            .addClass 'hide'

    unless safari?
        console.log 'Not Safari'
        $ '.not-safari'
            .removeClass 'hide'
        $ '.safari'
            .addClass 'hide'

    if typeof navigator.mozId is 'undefined'
        console.log 'Not Firefox'
        $ '.not-firefox'
            .removeClass 'hide'
        $ '.firefox'
            .addClass 'hide'
