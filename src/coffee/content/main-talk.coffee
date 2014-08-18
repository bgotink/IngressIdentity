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

        module.checkElement $root[0]

    observer = new window.MutationObserver (mutations) ->
        mutations.each (mutation) ->
            Array.prototype.each.call mutation.addedNodes, (node) ->
                module.checkElement node

    # use $root instead of document.body, because we don't want to fire our
    # listeners every time the user types a character.
    $root = null

    $ ->
        $ window.document.body
            .attr 'data-iidentity-timestamp', selfTimestamp
        selfDestructObserver.observe window.document.body,
            attributes: true

        module.extension.init() if module.extension.init?

        $root = $ '.Xg .Xg'

        if $root.length is 0
            # this is not a chat pane, but the main talk frame on the right
            $root = $ window.document.body

        module.comm.setOnUpdate forceUpdate

        forceUpdate()

        observer.observe $root[0], { childList: true, subtree: true }

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
