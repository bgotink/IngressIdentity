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

    var doOnceTimestamp,
        doOnce = function (elem, callback) {
            var $elem = $(elem),
                callbackArguments = Array.prototype.slice.call(arguments, 1);
            callbackArguments[0] = elem;

            if ($elem.attr('data-iidentity') === doOnceTimestamp) {
                // already performed
                return;
            }

            $elem.attr('data-iidentity', doOnceTimestamp);

            callback.apply(null, callbackArguments);
        },

        createBlockElement = function (oid, match, callback) {
            module.comm.getPlayer(oid, function (err, player) {
                if (err !== null) {
                    callback(err, null);
                    return;
                }

                if ((typeof player.level === 'string') && !player.level.match(/([0-9]|1[0-6])/)) {
                    player.level = 0;
                }

                var $groupInfo,
                    $extraInfo,
                    $name,
                    $elem = $('<div>')
                        .addClass('iidentity-wrapper')
                        .attr('data-oid', oid)
                        .append(
                            $name = $('<div>')
                                .addClass('iidentity-name')
                                .addClass('iidentity-faction-' + player.faction)
                                .text(player.nickname)
                        )
                        .append(
                            $extraInfo = $('<div>')
                                .addClass('iidentity-extra')
                        )
                        .append(
                            $groupInfo = $('<div>')
                                .addClass('iidentity-group')
                        );

                $extraInfo.append(
                    $('<span>')
                        .addClass('iidentity-level iidentity-level' + player.level)
                        .text('L' + ('0' == player.level ? '?' : player.level))
                );

                if ('anomaly' in player.extra) {
                    if (!Array.isArray(player.extra.anomaly)) {
                        player.extra.anomaly = [ player.extra.anomaly ];
                    }

                    var anomalyList = [];

                    player.extra.anomaly.forEach(function (anomaly) {
                        anomalyList.push(
                            $('<img>')
                                .attr('src', chrome.extension.getURL('img/anomalies/' + anomaly + '.png'))
                                .attr('alt', anomaly)
                                .attr('title', anomaly.substr(0, 1).toUpperCase() + anomaly.substr(1))
                                .addClass('iidentity-anomaly')
                        );
                    });

                    $name.append(
                        $('<div>')
                            .addClass('iidentity-anomalies')
                            .append(anomalyList)
                    );
                }

                if('community' in player.extra){
                    if (!Array.isArray(player.extra.community)) {
                        player.extra.community = [ player.extra.community ];
                    }

                    player.extra.community.forEach(function (community) {
                        var seperatorposition = community.indexOf(":");

                        if(seperatorposition === -1){
                            return;
                        }

                        $groupInfo.append(
                            $('<div>')
                                .append(
                                    $('<a>')
                                        .attr('href', 'https://plus.google.com/communities/' + community.substring(0,seperatorposition).trim())
                                        .text(community.substring(seperatorposition + 1 ).trim())
                                )
                        );
                    });
                }if('event' in player.extra){
                    if (!Array.isArray(player.extra.event)) {
                        player.extra.event = [ player.extra.event ];
                    }

                    player.extra.event.forEach(function (event) {
                        var seperatorposition = event.indexOf(":");

                        if(seperatorposition === -1){
                            return;
                        }

                        $groupInfo.append(
                            $('<div>')
                                .append(
                                    $('<a>')
                                        .attr('href', 'https://plus.google.com/events/' + event.substring(0,seperatorposition).trim())
                                        .text(event.substring(seperatorposition + 1 ).trim())
                                )
                        );
                    });
                }

                callback(null, $elem);
            }, { match: match });
        },
        createInlineElement = function (oid, match, callback) {
            module.comm.getPlayer(oid, function (err, player) {
                if (err !== null) {
                    callback(err, null);
                    return;
                }

                if ((typeof player.level === 'string') && !player.level.match(/([0-9]|1[0-6])/)) {
                    player.level = 0;
                }

                var $wrapper = $('<span>')
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
                    );

                if ('anomaly' in player.extra) {
                    if (!Array.isArray(player.extra.anomaly)) {
                        player.extra.anomaly = [ player.extra.anomaly ];
                    }

                    var anomalyList = [];

                    player.extra.anomaly.forEach(function (anomaly) {
                        anomalyList.push(
                            $('<img>')
                                .attr('src', chrome.extension.getURL('img/anomalies/' + anomaly + '.png'))
                                .attr('alt', anomaly)
                                .attr('title', anomaly.substr(0, 1).toUpperCase() + anomaly.substr(1))
                                .addClass('iidentity-anomaly')
                        );
                    });

                    $wrapper.append(
                        $('<span>')
                            .addClass('iidentity-anomalies')
                            .append(anomalyList)
                    );
                }

                callback(null, $wrapper);
            }, { match: match });
        },
        createConciseInlineElement = function (oid, match, callback) {
            module.comm.getPlayer(oid, function (err, player) {
                if (err !== null) {
                    callback(err, null);
                    return;
                }

                callback(
                    null,
                    $('<span>')
                        .addClass('iidentity-ciwrapper')
                        .addClass('iidentity-faction-' + player.faction)
                        .attr('data-oid', oid)
                        .text(player.nickname)
                );
            }, { match: match });
        },

        handlers = [
            {
                matches: [
                    'a.Ug[oid]', // profile pop-up
                ],
                handler: function (elem, match) {
                    var $elem = $(elem),
                        oid = $elem.attr('oid');

                    createBlockElement(oid, match, function (err, $infoElem) {
                        if (err) {
                            if (err === 'not-found') {
                                $elem.parent().find('.iidentity-wrapper[data-oid=' + oid + ']').remove();
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
                handler: function (elem, match) {
                    var $elem = $(elem),
                        oid = $elem.attr('oid');

                    createInlineElement(oid, match, function (err, $infoElem) {
                        if (err) {
                            if (err === 'not-found') {
                                $elem.parent().find('.iidentity-iwrapper[data-oid=' + oid + ']').remove();
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
            },
            {
                matches: [
                    'a.proflink.aaTEdf[oid]', // mentions
                ],
                handler: function (elem, match) {
                    var $elem = $(elem),
                        oid = $elem.attr('oid');

                    createConciseInlineElement(oid, match, function (err, $infoElem) {
                        if (err) {
                            if (err === 'not-found') {
                                $elem.parent().find('.iidentity-ciwrapper[data-oid=' + oid + ']').remove();
                                return;
                            }

                            console.error(err);
                            return;
                        }

                        $elem.parent().find('.iidentity-ciwrapper[data-oid=' + oid + ']').remove();

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

                        doOnce(this, handler.handler, match);
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
    module.comm.setOnUpdate(forceUpdate);

    observer.observe(window.document, { childList: true, subtree: true });

})(window.iidentity, window, window.jQuery);
