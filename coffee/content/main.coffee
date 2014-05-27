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
    doDeferred = (func) ->
        setTimeout func, 0

    observer = new window.MutationObserver (mutations) ->
        doDeferred ->
            module.log.log 'observer.onMutate'

            module.checkProfile()
            module.listSources()

            mutations.each (mutation) ->
                for i in [0..mutation.addedNodes.length-1]
                    module.checkElement mutation.addedNodes[i]

    forceUpdate = ->
        module.log.log 'forceUpdate'

        module.doOnce.update()

        module.checkProfile()
        module.listSources()

        module.checkElement window.document

    module.comm.setOnUpdate doDeferred.bind null, forceUpdate

    $ ->
        doDeferred ->
            forceUpdate()
            observer.observe window.document, { childList: true, subtree: true }

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
