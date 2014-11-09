# Helper functions to allow disabling logging.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, window) ->
    exports = module.log = {}

    console = window.console

    noProxy = ->
    proxy = (func) ->
        ->
            console[func].apply console, arguments

    exports.warn  = proxy 'warn'
    exports.error = proxy 'error'

    exports.setLoggingEnabled = (enable) ->
        if enable
            exports.assert = proxy 'assert'

            exports.trace  = proxy 'trace'
            exports.log    = proxy 'log'
            exports.debug  = proxy 'debug'
            exports.info   = proxy 'info'
        else
            exports.assert = noProxy

            exports.trace  = noProxy
            exports.log    = noProxy
            exports.debug  = noProxy
            exports.info   = noProxy

    exports.setLoggingEnabled true
)(iidentity or (iidentity = window.iidentity = {}), window)
