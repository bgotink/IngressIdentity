/**
 * Performs communication with the background page.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module) {
    var exports = module.comm = {};

    exports.send = function (request, callback) {
        chrome.runtime.sendMessage(request, callback);
    };

    exports.hasPlayer = function (oid, callback) {
        this.send({ type: 'hasPlayer', oid: oid }, function (result) {
            callback(result.result);
        });
    };

    exports.getPlayer = function (oid, callback) {
        this.send({ type: 'getPlayer', oid: oid}, function (result) {
            if (result.status !== 'success') {
                callback(result.status, null);
                return;
            }

            callback(null, result.player);
        });
    };
})(window.iidentity);
