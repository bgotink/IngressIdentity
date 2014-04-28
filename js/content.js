/**
 * The content script
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

/*
 * Use the following script on G+ pages to identify the elements containing a 'oid' attribute:
 *
 * (function () {
 * var result = {}, elems = document.querySelectorAll('[oid]'), i, length = elems.length, elem, key;
 * for(i = 0; i < length; i++) {
 *     elem = elems.item(i);
 *     key = elem.tagName.toLowerCase() + '.' + elem.className.split(' ').join('.');
 *     if (key in result) {
 *         result[key] ++;
 *     } else {
 *         result[key] = 1;
 *     }
 * }
 * console.log(result);
 * })();
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, window, $) {

    var doOnceTimestamp = '' + +new Date,
        doOnce = function (elem, callback) {
            var $elem = $(elem);

            if ($elem.attr('data-iidentity') === doOnceTimestamp) {
                // already performed
                return;
            }

            $elem.attr('data-iidentity', doOnceTimestamp);

            callback(elem);
        },

        createBlockElement = function (oid, callback) {
            module.comm.getPlayer(oid, function (err, player) {
                if (err !== null) {
                    callback(err, null);
                    return;
                }

                if ((typeof player.level === 'string') && !player.level.match(/([0-9]|1[0-6])/)) {
                    player.level = 0;
                }

                var $extraInfo, $elem = $('<div>')
                    .addClass('iidentity-wrapper')
                    .attr('data-oid', oid)
                    .append(
                        $('<div>')
                            .addClass('iidentity-name')
                            .addClass('iidentity-faction-' + player.faction)
                            .text(player.nickname)
                    )
                    .append(
                        $extraInfo = $('<div>')
                            .addClass('iidentity-extra')
                    );

                $extraInfo.append(
                    $('<span>')
                        .addClass('iidentity-level iidentity-level' + player.level)
                        .text('L' + ('0' == player.level ? '?' : player.level))
                );

                callback(null, $elem);
            });
        },
        createInlineElement = function (oid, callback) {
            module.comm.getPlayer(oid, function (err, player) {
                if (err !== null) {
                    callback(err, null);
                    return;
                }

                if ((typeof player.level === 'string') && !player.level.match(/([0-9]|1[0-6])/)) {
                    player.level = 0;
                }

                callback(null, $('<span>')
                    .addClass('iidentity-iwrapper')
                    .attr('data-oid', oid)
                    .append(
                        $('<span>')
                            .addClass('iidentity-name')
                            .addClass('iidentity-faction-' + player.faction)
                            .text(player.nickname)
                    )
                    .append(
                        $('<span>')
                            .addClass('iidentity-level iidentity-level' + player.level)
                            .text('L' + ('0' == player.level ? '?' : player.level))
                    )
                );
            });
        },

        handlers = [
            {
                matches: [
                    'a.Ug[oid]', // profile pop-up
                ],
                handler: function (elem) {
                    var $elem = $(elem),
                        oid = $elem.attr('oid');

                    createBlockElement(oid, function (err, $infoElem) {
                        if (err) {
                            if (err === 'not-found') {
                                return;
                            }

                            console.error(err);
                            return;
                        }

                        $elem.parent().find('.iidentity-wrapper[data-oid=' + oid + ']').remove();

                        $elem.after($infoElem);
                    });
                }
            },
            {
                matches: [
                    // 'a.ob.tv.Ub.Hf[oid]',  // post author
                    // 'a.ob.tv.Ub.TD[oid]',  // comment author
                    // 'a.ob.tv.Ub.ita[oid]', // event creator
                    'a.ob.tv.Ub[oid]',    // event rsvp; also matches all previous entries
                ],
                handler: function (elem) {
                    var $elem = $(elem),
                        oid = $elem.attr('oid');

                    createInlineElement(oid, function (err, $infoElem) {
                        if (err) {
                            if (err === 'not-found') {
                                return;
                            }

                            console.error(err);
                            return;
                        }

                        $elem.parent().find('.iidentity-iwrapper[data-oid=' + oid + ']').remove();

                        $elem.after(
                            $('<span>')
                                .text(' ')
                            ,
                            $infoElem
                        );
                    });
                }
            }
        ],
        checkElement = function (element) {
            var $root = (element === window.document) ? $(document) : $(element).parent();

            handlers.forEach(function (handler) {
                handler.matches.forEach(function (match) {
                    $root.find(match).each(function () {
                        if ($(this).attr('data-iidentity') == 'matched') {
                            return;
                        }

                        doOnce(this, handler.handler);
                    });
                });
            });
        },

    // Start listening for new nodes to traverse
        observer = new window.MutationObserver(function (mutations) {
            var i;

        	mutations.forEach(function (mutation) {
        		for(i = 0; i < mutation.addedNodes.length; i++) {
        			checkElement(mutation.addedNodes[i]);
        		}
        	});
        }),

        forceUpdate = function () {
            doOnceTimestamp = '' + +new Date;

            checkElement(window.document);
        };

    forceUpdate();
    observer.observe(window.document, { childList: true, subtree: true });

})(window.iidentity, window, window.jQuery);
