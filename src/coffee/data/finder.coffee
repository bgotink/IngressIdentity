# Interpret manifests and sources.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    exports = if Object.has module, 'data' then module.data else (module.data = {})

    standardPatternKeys = [ 'name', 'nickname' ]

    stringToRegExp = (str) ->
        re = ''

        if not str.startsWith '^'
            re += '^.*'

        re += (
            str.split /\s+/
                .join '(.*\\s+.*)?'
        )

        if not str.endsWith '$'
            re += '.*$'

        new RegExp re, 'i'

    # matches specific elements in player objects
    finderCreators =
        name: (pattern) ->
            re = stringToRegExp pattern

            (player) ->
                Object.has(player, 'name') and re.test player.name
        nickname: (pattern) ->
            re = stringToRegExp pattern
            (player) ->
                Object.has(player, 'nickname') and re.test player.nickname
        faction: (faction) ->
            if faction is 'unknown'
                (player) ->
                    not Object.has(player, 'faction') or player.faction is 'unknown'
            else
                (player) ->
                    Object.has(player, 'faction') and player.faction is faction

        extra:
            anomaly: (anomalies) ->
                # The anomalies match if all defined anomalies are present.
                # Extra anomalies might exist, doesn't matter!

                anomalies = [ anomalies ] unless Array.isArray anomalies

                switch anomalies.length
                    when 0
                        ->
                            true
                    when 1
                        anomaly = anomalies[0]
                        (player) ->
                            return false unless Object.has(player, 'extra') and Object.has(player.extra, 'anomaly')

                            if Array.isArray player.extra.anomaly
                                0 isnt player.extra.anomaly.count anomaly
                            else
                                player.extra.anomaly is anomaly
                    else
                        (player) ->
                            return false unless Object.has(player, 'extra') and Object.has(player.extra, 'anomaly')

                            # we match more than one anomaly, so the player can never match if it has but one anomaly.
                            return false unless Array.isArray player.extra.anomaly

                            anomalies.every (anomaly) ->
                                0 isnt player.extra.anomaly.count anomaly

    createPlayerFinder = (pattern) ->
        finders = []

        Object.each pattern, (key, value) ->
            if key is 'extra'
                Object.each value, (extraKey, extraValue) ->
                    if Object.has finderCreators.extra, extraKey
                        finders.push finderCreators.extra[extraKey] extraValue
                    else
                        throw new Error 'Cannot search on extra.' + extraKey
            else if Object.has finderCreators, key
                finders.push finderCreators[key] value
            else
                throw new Error 'Cannot search on ' + key

        (player, _) ->
            if Object.isObject _
                # looping over object, not calling directly or looping over array
                player = _

            finders.every (finder) ->
                finder player

    exports.createPlayerFinder = createPlayerFinder

    exports.createStandardPlayerFinder = (pattern) ->
        createPlayerFinder Object.select pattern, standardPatternKeys

)(iidentity or (iidentity = window.iidentity = {}))
