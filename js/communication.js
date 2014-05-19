/**
 * Performs communication with the background page.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module) {
    'use strict';

    var exports = module.comm = {},
        onUpdate = function () {},
        lastUpdate = +new Date;

    exports.send = function (request, callback) {
        request = { request: request, lastUpdate: lastUpdate };
        lastUpdate = +new Date;

        try {
            chrome.runtime.sendMessage(
                request,
                function (reply) {
                    if (typeof reply === 'undefined') {
                        module.log.error(chrome.runtime.lastError);
                    }

                    callback(reply.reply);

                    lastUpdate = +new Date;
                    if (reply.shouldUpdate) {
                        if (onUpdate) {
                            onUpdate();
                        }
                    }
                }
            );
        } catch (e) {
            // couldn't contact the extension
            // that can only mean one thing: extension has been reloaded, disabled or removed
            // -> reload this page
            window.document.location.reload();
        }
    };

    chrome.runtime.onMessage.addListener(function (request) {
        if (request.type === 'update') {
            lastUpdate = +new Date;

            if (onUpdate) {
                onUpdate();
            }

            // will not send reply
            return false;
        }

        // ignore: the options page gets all the messages meant for the background
        // page as well... logging/throwing here would fill the console with junk
        return false;
    });

    exports.hasPlayer = function (oid, callback) {
        this.send({ type: 'hasPlayer', oid: oid }, function (result) {
            callback(result.result);
        });
    };

    exports.getPlayer = function (oid, callback, extra) {
        var request = { type: 'getPlayer', oid: oid };

        if (typeof extra !== 'undefined' && extra !== null)
            request.extra = extra;

        this.send(request, function (result) {
            if (result.status !== 'success') {
                callback(result.status, null);
                return;
            }

            callback(null, result.player);
        });
    };

    exports.setOnUpdate = function (callback) {
        onUpdate = callback;
    };

    exports.getSourcesForExtra = function (tag, oid, callback) {
        this.send({ type: 'getSourcesForExtra', tag: tag, oid: oid }, function (result) {
            callback(result.result);
        });
    };
})(window.iidentity);
