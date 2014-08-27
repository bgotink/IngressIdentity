# Merges player data.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    exports = if Object.has module, 'data' then module.data else module.data = {}

    # variables

    anomalies = [ '13magnus', 'recursion', 'interitus', 'initio', 'helios' ]
    validFactions = [ 'enlightened', 'resistance', 'unknown', 'error' ]

    # general helpers

    doEach = (obj, key, func) ->
        if not Object.has obj, key
            return;

        if Array.isArray obj[key]
            obj[key].each (e) ->
                if false is func e
                    obj[key].remove e
        else
            if false is func obj[key]
                delete obj[key]

    # validation & merging helpers

    getExtraDataValueName = (str) ->
        i = str.indexOf ':'

        if i is -1
            str.compact().toLowerCase()
        else
            str.to(i).compact().toLowerCase()

    addToArray = (src, dst) ->
        if not Array.isArray src
            src = [ src ];

        existing = []

        dst.each (elem) ->
            existing.push getExtraDataValueName elem

        src.each (elem) ->
            name = getExtraDataValueName elem

            if existing.indexOf(name) is -1
                dst.push elem
                existing.push name

    helpers =
        validate:
            checkExists: (obj, key, err) ->
                if not Object.has obj, key
                    err.push 'Expected key "' + key + '" to exist.'
            checkValidPage: (obj, key, err) ->
                doEach obj, key, (value) ->
                    if not Object.isString(value) or value.indexOf(':') is -1
                        err.push 'Invalid ' + key + ': "' + value + '"'
                        false
            checkValidAnomaly: (obj, key, err) ->
                doEach obj, key, (value) ->
                    if not Object.isString(value) or anomalies.indexOf(value.compact().toLowerCase()) is -1
                        err.push 'Invalid anomaly: "' + value + '"'
                        false
            checkFactions: (arr, err) ->
                if arr.length is 0
                    return;

                factions = {}

                arr
                    .exclude { faction: 'unknown' }, { faction: 'error' }
                    .each (object) ->
                        if Object.has object, 'faction'
                            factions[('' + object.faction).compact().toLowerCase()] = true;

                if 1 < Object.size factions
                    err.push 'Player has multiple factions: ' + Object.keys(factions).join(', ')
                    arr.each (object) ->
                        object.faction = 'error'
            checkValidLevel: (object, err) ->
                if not Object.has object, 'level'
                    return;

                if not (Object.isString(object.level) || Object.isNumber(object.level)) and not ('' + object.level).compact().match(/^([0-9]|1[0-6]|\?|)$/)
                    err.push 'Invalid level: "' + object.level + '"'
                    delete object.level
            checkValidFaction: (object, err) ->
                if not Object.has object, 'faction'
                    return

                if -1 is validFactions.indexOf object.faction
                    err.push 'Invalid faction: "' + object.faction + '"'
                    delete object.faction

        merge:
            # default merge function
            '.default': (target, src, key) ->
                target[key] = src[key]

            # merge functions for specific data values
            # for function func, src[func] is bound to exist,
            # there's no guarantee for target[func] unless noted otherwise
            err: (target, src) ->
                if not Object.has target, 'err'
                    target.err = []
                else if not Array.isArray target.err
                    target.err = [ target.err ]

                if Array.isArray src.err
                    target.err = target.err.concat src.err
                else
                    target.err.push src.err
            faction: (target, src) ->
                if not Object.has(target, 'faction') or (src.faction isnt 'unknown' && target.faction isnt 'error')
                    target.faction = src.faction
            extra: (target, src) ->
                # target has extra, see merge function
                Object.each src.extra, (key, srcValue) ->
                    if Object.has target.extra, key
                        if Array.isArray target.extra[key]
                            addToArray srcValue, target.extra[key]
                        else if Object.isBoolean target.extra[key]
                            target.extra[key] = target.extra[key] || (!!srcValue)
                        else
                            tmp = [ target.extra[key] ]
                            addToArray srcValue, tmp

                            if tmp.length > 1
                                target.extra[key] = tmp
                    else
                        target.extra[key] = srcValue
            level: (target, src) ->
                # target has level, see merge function
                level = +src.level;

                if isNaN level
                    return;

                level = Number.range(0, 16).clamp level

                if level > target.level
                    target.level = level;

    # pre-merge validation

    pre_validate = (arr, err) ->
        arr.each (object) ->
            if Object.has object, 'extra'
                helpers.validate.checkValidPage object.extra, 'event', err
                helpers.validate.checkValidPage object.extra, 'community', err

                helpers.validate.checkValidAnomaly object.extra, 'anomaly', err

            helpers.validate.checkValidLevel object, err
            helpers.validate.checkValidFaction object, err

        helpers.validate.checkFactions arr, err

    # post-merge validation

    post_validate = (object, err) ->
        helpers.validate.checkExists object, 'faction', err
        helpers.validate.checkExists object, 'level', err
        helpers.validate.checkExists object, 'nickname', err
        helpers.validate.checkExists object, 'oid', err

    merge = ->
        if arguments.length is 0
            return false
        else if arguments.length is 1
            return arguments[0]

        target = arguments[0]
        src = arguments[1]

        if not Object.isObject target.extra
            target.extra = {}
        if not Object.has target, 'level'
            target.level = 0

        Object.keys(src).each (key) ->
            if Object.has helpers.merge, key
                helpers.merge[key] target, src
            else
                helpers.merge['.default'] target, src, key

        newArguments = Array.prototype.slice.call arguments, 1
        newArguments[0] = target;

        merge.apply null, newArguments

    exports.merge = (arr, err) ->
        pre_validate arr, err
        merge.apply null, arr

    exports.merge.validate = (obj, err) ->
        post_validate obj, err

)(iidentity or (iidentity = window.iidentity = {}))
