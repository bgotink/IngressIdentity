# Helper functions to allow disabling logging.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, window) ->
    exports = module.log = {}

    noProxy = ->
    proxy = (func) ->
        ->
            func.apply window.console, arguments

    exports.warn  = proxy window.console.warn
    exports.error = proxy window.console.error

    exports.setLoggingEnabled = (enable) ->
        if enable
            exports.assert = proxy window.console.assert

            exports.trace  = proxy window.console.trace
            exports.log    = proxy window.console.log
            exports.debug  = proxy window.console.debug
            exports.info   = proxy window.console.info
        else
            exports.assert = noProxy

            exports.trace  = noProxy
            exports.log    = noProxy
            exports.debug  = noProxy
            exports.info   = noProxy

    exports.setLoggingEnabled true
)(iidentity or (iidentity = window.iidentity = {}), window)
