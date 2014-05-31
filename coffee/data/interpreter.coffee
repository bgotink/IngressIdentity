# Interpret manifests and sources.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    exports = (if Object.has(module, 'data') then module.data else (module.data = {})).interpreter = {}

    standardManifestKeys = [ 'key', 'lastupdated', 'tag', 'faction', 'refresh' ]
    standardSourceKeys = [ 'oid', 'nickname', 'name', 'level' ]

    anomalies = [ '13magnus', 'recursion', 'interitus' ]

    filterEmpty = (obj) ->
        Object.each obj, (key, value) ->
            if Object.isObject value
                filterEmpty obj[key]
            else if value is undefined or value is null or ('' + value).isBlank()
                delete obj[key]

    # An instance of ManifestEntry represents one row in a manifest.
    class ManifestEntry
        constructor: (data) ->
            @err = [];

            data = filterEmpty Object.clone data, true

            @manifestData = Object.select data, standardManifestKeys
            @nonManifestData = Object.reject data, standardManifestKeys

            @checkValid()
            # todo: use validators to check extra data

        checkValid: ->
            if Object.has @nonManifestData, 'extratags'
                # old-school stuff
                if not Object.extended(@nonManifestData).reject('extratags').isEmpty()
                    @err.push 'Using old-type extratags combined with extra columns is discouraged.'

        getExtraData: ->
            extratags = null;

            if Object.has @nonManifestData, 'extratags'
                try
                    extratags = JSON.parse @nonManifestData.extratags
                catch e
                    @err.push 'Invalid JSON in extratags: ' + e
                    extratags = null

            if not extratags?
                Object.reject @nonManifestData, 'extratags'
            else
                # extra columns override extratags
                $.extend true, extratags, Object.reject(@nonManifestData, 'extratags')

        getManifestData: -> @manifestData;
        getData: ->
            if Object.has @, 'data'
                return @data

            @data =
                faction: @getFaction()
                extra:   @getExtraData()

        # Gets the player data combined with this manifests data
        getPlayerData: (playerData) ->
            # data in source override data in manifest
            $.extend true, {}, @getData(), filterEmpty Object.clone(playerData, true)

        getTag: -> @getManifestData().tag
        getVersion: -> @getManifestData().lastupdated
        getFaction: -> @getManifestData().faction;

        hasExtra: (tag, oid) ->
            extra = @getData().extra

            if not Object.has(extra, tag) or not Object.isString(extra[tag])
                return false

            i = extra[tag].indexOf ':'
            (i isnt -1) and (oid is extra[tag].to(i).compact());

        getErr: -> if @err.length > 0 then @err else null

    readSource = (data) ->
        result = Object.select data, standardSourceKeys, 'faction'
        result.extra = Object.reject data, standardSourceKeys, 'faction'
        result

    exports.interpretManifestEntry = (data) ->
        new ManifestEntry(data)

    exports.interpretSourceEntry = (manifestEntry, data) ->
        manifestEntry.getPlayerData readSource data
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
