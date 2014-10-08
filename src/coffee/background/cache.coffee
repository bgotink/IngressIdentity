# A simple cache.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    class Cache
        constructor: ->
            @clear()

        has: (key) ->
            return false unless @data.has key

            return not @data[key].expire? or (+new Date) < @data[key].expire

        get: (key) ->
            return null unless @has key

            @data[key].value

        set: (key, value, expire = 60000) ->
            @data[key] =
                value: value
                expire: if expire? then (+new Date) + expire else null

        remove: (key) ->
            delete @data[key] if @data.has key

        clear: ->
            @data = Object.extended {}

    module.Cache = Cache
)(iidentity or (iidentity = window.iidentity = {}))
