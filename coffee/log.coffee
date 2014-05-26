# Helper functions to allow disabling logging.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, window) ->
    exports = (module.log = {})
    enableLogging = true

    proxy = (func, force) ->
        ->
            if (force || enableLogging)
                func.apply window.console, arguments

    exports.assert = proxy window.console.assert

    exports.trace = proxy window.console.trace
    exports.log   = proxy window.console.log
    exports.debug = proxy window.console.debug
    exports.info  = proxy window.console.info
    exports.warn  = proxy window.console.warn, true
    exports.error = proxy window.console.error, true

    exports.setLoggingEnabled = (enable) ->
        enableLogging = !!enable
)(window.iidentity = (window.iidentity || {}), window)
