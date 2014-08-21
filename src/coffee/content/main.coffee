# The main content script
#
# @author Bram Gotink (@bgotink)
# @license MIT

# Use the following script on G+ pages to identify the elements containing a 'oid' attribute:
#
# (function () {
# var result = {}, elems = document.querySelectorAll('[oid]'), i, length = elems.length, elem, key;
# for(i = 0; i < length; i++) {
#     elem = elems.item(i);
#     key = elem.tagName.toLowerCase() + '.' + elem.className.split(' ').join('.');
#     if (key in result) {
#         result[key] ++;
#     } else {
#         result[key] = 1;
#     }
# }
# console.log(result);
# })();

((module, $, window) ->
    selfTimestamp = '' + +new Date

    observer = new window.MutationObserver (mutations) ->
        module.checkProfile()
        module.listSources()
        module.addExport()

        mutations.each (mutation) ->
            Array.prototype.each.call mutation.addedNodes, (node) ->
                module.checkElement node

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

        module.checkProfile()
        module.listSources()
        module.addExport()

        module.checkElement window.document

    $ ->
        $ window.document.body
            .attr 'data-iidentity-timestamp', selfTimestamp
        selfDestructObserver.observe window.document.body,
            attributes: true

        module.extension.init() if module.extension.init?

        module.i18n.init ->
            module.comm.setOnUpdate forceUpdate

            forceUpdate()
            observer.observe window.document, { childList: true, subtree: true }

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
