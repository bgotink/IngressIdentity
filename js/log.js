/**
 * Helper functions to allow disabling logging.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, window) {
    var exports = (module.log = {}),
        enableLogging = true,
        proxy = function (func) {
            return function () {
                if (enableLogging) {
                    func.apply(window.console, arguments);
                }
            };
        };

    exports.assert = proxy(window.console.assert);

    exports.trace = proxy(window.console.trace);
    exports.log   = proxy(window.console.log);
    exports.debug = proxy(window.console.debug);
    exports.info  = proxy(window.console.info);
    exports.warn  = proxy(window.console.warn);
    exports.error = proxy(window.console.error);

    exports.setLoggingEnabled = function (enable) {
        enableLogging = !!enable;
    };
})(window.iidentity, window);
