# doOnce function
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    timestamp = '0'

    module.doOnce = (elem, callback) ->
        $elem = $ elem
        callbackArguments = Array.prototype.slice.call arguments, 1
        callbackArguments[0] = elem

        if timestamp is $elem.attr 'data-iidentity'
            # already performed
            return

        $elem.attr 'data-iidentity', timestamp

        callback.apply null, callbackArguments

    module.doOnce.update = ->
        timestamp = '' + +new Date

    module.doOnce.timestamp = -> timestamp
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
