/**
 * Performs communication with the background page.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module) {
    var exports = module.comm = {},
        onUpdate = function () {},
        lastUpdate = +new Date;

    exports.send = function (request, callback) {
        request = { request: request, lastUpdate: lastUpdate };
        lastUpdate = +new Date;

        chrome.runtime.sendMessage(
            request,
            function (reply) {
                callback(reply.reply);

                lastUpdate = +new Date;
                if (reply.shouldUpdate) {
                    if (onUpdate) {
                        onUpdate();
                    }
                }
            }
        );
    };

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
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

    exports.hasPermission = function (permission, callback) {
        this.send({ type: 'hasPermission', permission: permission }, function (result) {
            callback(result.hasPermission);
        });
    };
})(window.iidentity);
