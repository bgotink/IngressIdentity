# The main script for Google Talk pages
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $, window) ->
    selfTimestamp = '' + +new Date

    selfDestructObserver = new window.MutationObserver (mutations) ->
        mutations.each (mutation) ->
            return unless mutation.type is 'attributes' and mutation.attributeName is 'data-iidentity-timestamp'

            newTimestamp = $ mutation.target
                .attr 'data-iidentity-timestamp'

            return if newTimestamp is selfTimestamp

            module.log.info 'Self-destructing', selfTimestamp, 'due to loading of second extension instance', newTimestamp

            # stop this extension
            observer.disconnect()
            module.comm.setOnUpdate ->

            selfDestructObserver.disconnect()

            false

    forceUpdate = ->
        module.doOnce.update()

        module.checkElement window.document

    observer = new window.MutationObserver (mutations) ->
        mutations.each (mutation) ->
            Array.prototype.each.call mutation.addedNodes, (node) ->
                module.checkElement node

    $ ->
        $ window.document.body
            .attr 'data-iidentity-timestamp', selfTimestamp
        selfDestructObserver.observe window.document.body,
            attributes: true

        module.extension.init() if module.extension.init?

        module.comm.setOnUpdate forceUpdate

        forceUpdate()
        observer.observe window.document, { childList: true, subtree: true }

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
