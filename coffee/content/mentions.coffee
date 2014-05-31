# Add player info on Google+
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $, window) ->
    doForEach = (player, isExtra, key, each, done) ->
        obj = if isExtra then player.extra else player

        if Object.has obj, key
            obj = if Array.isArray obj[key] then obj[key] else [ obj[key] ]
            results = []

            obj.each (elem, i) ->
                o = each(elem, i)
                results.push o if o
            done results if done

    createBlockElement = (oid, match, callback) ->
        module.comm.getPlayer oid, (err, player) ->
            if err?
                callback err, null
                return

            $elem = $ '<div>'
                .addClass 'iidentity-wrapper'
                .attr 'data-oid', oid
                .append(
                    $name = $ '<div>'
                        .addClass 'iidentity-name'
                        .addClass 'iidentity-faction-' + player.faction
                        .text player.nickname
                )
                .append(
                    $extraInfo = $ '<div>'
                        .addClass 'iidentity-extra'
                )
                .append(
                    $groupInfo = $ '<div>'
                        .addClass 'iidentity-group'
                )

            if Object.isNumber player.level
                level = '' + Number.range 0, 16
                    .clamp player.level
            else
                if Object.isString(player.level) and player.level.match /([0-9]|1[0-6])/
                    level = player.level
                else
                    level = '0'

            $extraInfo.append(
                $ '<span>'
                    .addClass 'iidentity-level iidentity-level' + level
                    .text 'L' + (if '0' == level then '?' else level)
            );

            doForEach player, true, 'anomaly', (anomaly) ->
                    $ '<img>'
                        .attr 'src', chrome.extension.getURL 'img/anomalies/' + anomaly + '.png'
                        .attr 'alt', anomaly
                        .attr 'title', anomaly.capitalize true
                        .addClass 'iidentity-anomaly'
                , (anomalyList) ->
                    $name.append(
                        $ '<div>'
                            .addClass 'iidentity-anomalies'
                            .append anomalyList
                    )

            doForEach player, true, 'community', (community, i) ->
                seperatorposition = community.indexOf ':'

                if i > 3
                    return false
                if i is 3
                    $groupInfo.append(
                        $ '<div>'
                            .html '&hellip;'
                    )
                    return false

                if seperatorposition is -1
                    return

                $groupInfo.append(
                    $ '<div>'
                        .append(
                            $ '<a>'
                                .attr 'href', 'https://plus.google.com/communities/' + community.to(seperatorposition).compact()
                                .text community.from(seperatorposition + 1).compact()
                        )
                )

            doForEach player, true, 'event', (event, i) ->
                seperatorposition = event.indexOf ':'

                if i > 3
                    return false
                if i is 3
                    $groupInfo.append(
                        $ '<div>'
                            .html '&hellip;'
                    )
                    return false

                if seperatorposition is -1
                    return

                $groupInfo.append(
                    $ '<div>'
                        .append(
                            $ '<a>'
                                .attr 'href', 'https://plus.google.com/events/' + event.to(seperatorposition).compact()
                                .text event.from(seperatorposition + 1).compact()
                        )
                )

            Object.extended player.extra
                .reject 'anomaly', 'community', 'event'
                .each (name, value) ->
                    if not Array.isArray value
                        value = [ value ]

                    # allow two kinds of custom extra tags:
                    # boolean & string
                    # boolean: if array contains a true value, show name
                    #          in $extraInfo
                    # otherwise: show extra div etc.

                    if (value.any (e) -> (e is true))
                        $extraInfo.append(
                            $ '<span>'
                                .text name.humanize()
                        )

                        return

                    $groupInfo.append(
                        $ '<div>'
                            .addClass 'iidentity-custom-extratag'
                            .append(
                                $ '<b>'
                                    .text name.humanize() + ':'
                            )
                            .append(
                                $ value
                                    .map ->
                                        ($ '<span>'
                                            .text @compact().capitalize())[0]
                            )
                    )

            callback null, $elem
        , { match: match }
    createInlineElement = (oid, match, callback) ->
        module.comm.getPlayer oid, (err, player) ->
            if err?
                callback err, null
                return

            if Object.isNumber player.level
                level = '' + Number.range(0, 16).clamp(player.level)
            else
                if Object.isString(player.level) and player.level.match /([0-9]|1[0-6])/
                    level = player.level
                else
                    level = '0'

            $wrapper = $ '<span>'
                .addClass 'iidentity-iwrapper'
                .attr 'data-oid', oid
                .append(
                    $ '<span>'
                        .addClass 'iidentity-name'
                        .addClass 'iidentity-faction-' + player.faction
                        .text player.nickname
                )
                .append(
                    $ '<span>'
                        .addClass 'iidentity-level iidentity-level' + level
                        .text 'L' + (if '0' == level then '?' else level)
                )

            doForEach player, true, 'anomaly', (anomaly) ->
                    $ '<img>'
                        .attr 'src', chrome.extension.getURL 'img/anomalies/' + anomaly + '.png'
                        .attr 'alt', anomaly
                        .attr 'title', anomaly.capitalize true
                        .addClass 'iidentity-anomaly'
                , (anomalyList) ->
                    $wrapper.append(
                        $ '<span>'
                            .addClass 'iidentity-anomalies'
                            .append anomalyList
                    )

            callback null, $wrapper
        , { match: match }
    createConciseInlineElement = (oid, match, callback) ->
        module.comm.getPlayer oid, (err, player) ->
            if err?
                callback err, null
                return

            callback(null, $ '<span>'
                .addClass 'iidentity-ciwrapper'
                .addClass 'iidentity-faction-' + player.faction
                .attr 'data-oid', oid
                .text player.nickname
            )
        , { match: match }

    handlers = [
        {
            matches: [
                'a.Ug[oid]', # profile pop-up
            ]
            handler: (elem, match) ->
                $elem = $ elem
                oid = $elem.attr 'oid'

                createBlockElement oid, match, (err, $infoElem) ->
                    if err?
                        if err == 'not-found'
                            $elem
                                .parent()
                                .find '.iidentity-wrapper[data-oid=' + oid + ']'
                                .remove()
                            return

                        modue.log.error err
                        return

                    $elem
                        .parent()
                        .find '.iidentity-wrapper[data-oid=' + oid + ']'
                        .remove()

                    $elem.after $infoElem
        },
        {
            matches: [
                # 'a.ob.tv.Ub.Hf[oid]',             # post author, also on Google API
                # 'a.ob.tv.Ub.TD[oid]',             # comment author
                # 'a.ob.tv.Ub.ita[oid]',            # event creator
                'a.ob.tv.Ub[oid]',                  # event rsvp; also matches all previous entries
                'div.o0b[oid]',                     # friend lists on profile page
                'div.f5.wy > header > h3 > a[oid]', # comments in Google API
            ]
            handler: (elem, match) ->
                $elem = $ elem
                oid = $elem.attr 'oid'

                createInlineElement oid, match, (err, $infoElem) ->
                    if err?
                        if err == 'not-found'
                            $elem
                                .parent()
                                .find '.iidentity-iwrapper[data-oid=' + oid + ']'
                                .remove()
                            return

                        module.log.error err
                        return

                    $elem
                        .parent()
                        .find '.iidentity-iwrapper[data-oid=' + oid + ']'
                        .remove()

                    $elem.after $('<span class="iidentity-spacer">'), $('<wbr>'), $infoElem
        },
        {
            matches: [
                'a.proflink.aaTEdf[oid]', # mentions
            ]
            handler: (elem, match) ->
                $elem = $ elem
                oid = $elem.attr 'oid'

                createConciseInlineElement oid, match, (err, $infoElem) ->
                    if err?
                        if err == 'not-found'
                            $elem
                                .parent()
                                .find '.iidentity-ciwrapper[data-oid=' + oid + ']'
                                .remove()
                            return

                        module.log.error err
                        return

                    $elem
                        .parent()
                        .find '.iidentity-ciwrapper[data-oid=' + oid + ']'
                        .remove()

                    $elem.after $('<span>').text(' '), $infoElem
        }
    ]

    module.checkElement = (element) ->
        $root = if element is window.document then $ document else $(element).parent()

        handlers.each (handler) ->
            handler.matches.each (match) ->
                $root
                    .find match
                    .each ->
                        if 'matched' is $(@).attr 'data-iidentity'
                            return

                        module.doOnce @, handler.handler, match
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
