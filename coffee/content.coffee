# The main script for the options page
#
# @author Bram Gotink (@bgotink)
# @license MIT

# Use the following script on G+ pages to identify the elements containing a 'oid' attribute:
#
# (function () {
# var result = {}, elems = document.querySelectorAll('[oid]'), i, length = elems.length, elem, key;
# for(i = 0; i < length; i++) {
#     elem = elems.item(i);
#     key = elem.tagName.toLowerCase() + '.' + elem.className.split(' ').join('.');
#     if (key in result) {
#         result[key] ++;
#     } else {
#         result[key] = 1;
#     }
# }
# console.log(result);
# })();

((module, $, window) ->
    doOnceTimestamp = 0
    doOnce = (elem, callback) ->
        $elem = $ elem
        callbackArguments = Array.prototype.slice.call arguments, 1
        callbackArguments[0] = elem

        if  doOnceTimestamp == $elem.attr 'data-iidentity'
            # already performed
            return

        $elem.attr 'data-iidentity', doOnceTimestamp

        callback.apply null, callbackArguments

    createBlockElement = (oid, match, callback) ->
        module.comm.getPlayer oid, (err, player) ->
            if err != null
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
                if Object.isString(player.level) and player.level.match(/([0-9]|1[0-6])/)
                    level = player.level
                else
                    level = '0'

            $extraInfo.append(
                $ '<span>'
                    .addClass 'iidentity-level iidentity-level' + level
                    .text 'L' + (if '0' == level then '?' else level)
            );

            if Object.has player.extra, 'anomaly'
                if not Array.isArray player.extra.anomaly
                    player.extra.anomaly = [ player.extra.anomaly ]

                anomalyList = []

                player.extra.anomaly.each (anomaly) ->
                    anomalyList.push(
                        $ '<img>'
                            .attr 'src', chrome.extension.getURL 'img/anomalies/' + anomaly + '.png'
                            .attr 'alt', anomaly
                            .attr 'title', anomaly.capitalize true
                            .addClass 'iidentity-anomaly'
                    )

                $name.append(
                    $ '<div>'
                        .addClass 'iidentity-anomalies'
                        .append anomalyList
                )

            if Object.has player.extra, 'community'
                if not Array.isArray player.extra.community
                    player.extra.community = [ player.extra.community ]

                player.extra.community.each (community, i) ->
                    seperatorposition = community.indexOf ':'

                    if i > 3
                        return
                    if i == 3
                        $groupInfo.append(
                            $ '<div>'
                                .html '&hellip;'
                        )
                        return

                    if seperatorposition == -1
                        return

                    $groupInfo.append(
                        $ '<div>'
                            .append(
                                $ '<a>'
                                    .attr 'href', 'https://plus.google.com/communities/' + community.to(seperatorposition).compact()
                                    .text community.from(seperatorposition + 1).compact()
                            )
                    )

            if Object.has player.extra, 'event'
                if not Array.isArray player.extra.event
                    player.extra.event = [ player.extra.event ]

                player.extra.event.each (event, i) ->
                    seperatorposition = event.indexOf ':'

                    if i > 3
                        return
                    if i == 3
                        $groupInfo.append(
                            $ '<div>'
                                .html '&hellip;'
                        )
                        return

                    if seperatorposition == -1
                        return

                    $groupInfo.append(
                        $ '<div>'
                            .append(
                                $ '<a>'
                                    .attr 'href', 'https://plus.google.com/events/' + event.to(seperatorposition).compact()
                                    .text event.from(seperatorposition + 1).compact()
                            )
                    )

                customExtra = Object.extended player.extra
                    .reject 'anomaly', 'community', 'event'

                customExtra.each (name, value) ->
                    if not Array.isArray value
                        value = [ value ]

                    # allow two kinds of custom extra tags:
                    # boolean & string
                    # boolean: if array contains a true value, show name
                    #          in $extraInfo
                    # otherwise: show extra div etc.

                    if (value.any (e) -> (e == true))
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
            if err != null
                callback err, null
                return

            if Object.isNumber player.level
                level = '' + Number.range(0, 16).clamp(player.level)
            else
                if Object.isString(player.level) and player.level.match(/([0-9]|1[0-6])/)
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

            if Object.has player.extra, 'anomaly'
                if not Array.isArray player.extra.anomaly
                    player.extra.anomaly = [ player.extra.anomaly ]

                anomalyList = []

                player.extra.anomaly.each (anomaly) ->
                    anomalyList.push(
                        $ '<img>'
                            .attr 'src', chrome.extension.getURL 'img/anomalies/' + anomaly + '.png'
                            .attr 'alt', anomaly
                            .attr 'title', anomaly.capitalize true
                            .addClass 'iidentity-anomaly'
                    )

                $wrapper.append(
                    $ '<span>'
                        .addClass 'iidentity-anomalies'
                        .append anomalyList
                )

            callback null, $wrapper
        , { match: match }
    createConciseInlineElement = (oid, match, callback) ->
        module.comm.getPlayer oid, (err, player) ->
            if err != null
                callback err, null
                return

            callback null, $ '<span>'
                    .addClass 'iidentity-ciwrapper'
                    .addClass 'iidentity-faction-' + player.faction
                    .attr 'data-oid', oid
                    .text player.nickname
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
                    if err
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
                # 'a.ob.tv.Ub.Hf[oid]',  # post author
                # 'a.ob.tv.Ub.TD[oid]',  # comment author
                # 'a.ob.tv.Ub.ita[oid]', # event creator
                'a.ob.tv.Ub[oid]',    # event rsvp; also matches all previous entries
                'div.o0b[oid]',       # friend lists on profile page
            ]
            handler: (elem, match) ->
                $elem = $ elem
                oid = $elem.attr 'oid'

                createInlineElement oid, match, (err, $infoElem) ->
                    if err
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
                    if err
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
    checkElement = (element) ->
        $root = if element == window.document then $ document else $(element).parent()

        handlers.each (handler) ->
            handler.matches.each (match) ->
                $root
                    .find match
                    .each ->
                        if 'matched' == $(this).attr 'data-iidentity'
                            return

                        doOnce this, handler.handler, match

    profileHelper =
        createWrapper: ->
            return $(
                '<div class="Ee h5a vna iidentity-profile-wrapper" role="article">' +
                    '<div class="ZYa ukoEtf">' +
                        '<div class="Lqc">' +
                            '<div class="F9a">Ingress Agent Profile</div>' +
                            '<div class="miIoOb Cdmn9d"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="Uia"><div class="iec Iqc iidentity-profile"></div></div>' +
                    '<div class="Iqc"></div>' +
                '</div>'
            )

        createTable: (rows) ->
            $ '<div class="Qqc wna"></div>'
                .append rows
        createRow: (left, right) ->
            $ """
                <div class="wna DVb">
                    <div class="E9a G9a Rqc">#{ left }</div>
                    <div class="y4 G9a">#{ right }</div>
                </div>
              """

        createAnomalySubtitle: (anomalies) ->
            $ '<div class="wna fa-TCa Ala">'
                .append(
                    $ '<div class="Cr Aha">Anomalies</div>'
                )
                .append(
                    $ '<div class="y4"></div>'
                        .append(
                            $ '<ul class="Kla yVa">'
                                .append(
                                    $ anomalies.map (anomaly) ->
                                        nice = anomaly.capitalize true

                                        $ '<li>'
                                            .append(
                                                $ '<img>'
                                                    .addClass 'xfa'
                                                    .attr 'src', chrome.extension.getURL 'img/anomalies/' + anomaly + '.png'
                                                    .attr 'title', nice
                                                    .attr 'alt', ''
                                            )
                                            .append(
                                                $ '<div class="fIa s"></div>'
                                                    .append(
                                                        $ '<span class="OLa Xvc"></span>'
                                                            .text nice
                                                    )
                                            )[0]
                                )
                        )
                )
        createSubtitle: (subtitle, items) ->
            $ '<div class="wna fa-TCa Ala">'
                .append(
                    $ '<div class="Cr Aha"></div>'
                        .text subtitle
                )
                .append(
                    $ '<div class="y4"></div>'
                        .append(
                            $ '<ul class="Kla yVa">'
                                .append(
                                    $ items.map ->
                                            $ '<li>'
                                                .append(this)[0]
                                )
                        )
                )
        createLinkedSubtitle: (subtitle, links, baseUrl) ->
            profileHelper.createSubtitle subtitle, $ links.map (link) ->
                i = link.indexOf ':'
                if i == -1
                    return null

                url = baseUrl + link.to(i).compact()
                title = link.from(i + 1).compact()

                $ '<div class="fIa s"></div>'
                    .append(
                        $ '<a class="OLa url Xvc"></a>'
                            .text title
                            .attr 'title', title
                            .attr 'href', url
                    )[0]
    createProfile = (player, wrapper) ->
        $wrapper = $ wrapper
        $profile = $wrapper.find '.iidentity-profile'

        if player.faction == 'enlightened'
            $wrapper
                .removeClass 'Mqc'
                .addClass 'Hqc'
        else if player.faction == 'resistance'
            $wrapper
                .removeClass 'Hqc'
                .addClass 'Mqc'
        else
            $wrapper.removeClass 'Mqc Hqc'

        $wrapper
            .removeClass 'iidentity-faction-enlightened iidentity-faction-resistance iidentity-faction-error iidentity-faction-unknown'
            .addClass 'iidentity-faction-' + player.faction

        if Object.isNumber player.level
            level = '' + Number.range(0, 16).clamp(player.level)
        else
            if Object.isString(player.level) and player.level.match(/([0-9]|1[0-6])/)
                level = player.level
            else
                level = '0'

        customExtra = Object.extended player.extra
            .reject 'anomaly', 'community', 'event'

        $profile
            .html ''
            .append(
                profileHelper.createTable(
                    [
                        profileHelper.createRow 'Agent name', player.nickname
                        profileHelper.createRow 'Level', 'L' + (if level == '0' then '?' else level)
                        profileHelper.createRow 'Faction', player.faction.capitalize()
                    ].concat(customExtra.keys()
                        .filter (e) ->
                            v = customExtra[e];

                            if Array.isArray v
                                if v.length != 1
                                    false

                                v = v[0]

                            Object.isString v
                        .map (e) ->
                            v = customExtra[e]

                            profileHelper.createRow e.humanize(), (if Array.isArray(v) then v[0] else v).compact().capitalize()
                    )
                )
            )

        if Object.has player.extra, 'anomaly'
            if not Array.isArray player.extra.anomaly
                player.extra.anomaly = [ player.extra.anomaly ]

            $profile.append profileHelper.createAnomalySubtitle player.extra.anomaly

        if Object.has player.extra, 'community'
            if not Array.isArray player.extra.community
                player.extra.community = [ player.extra.community ]

            $profile.append profileHelper.createLinkedSubtitle 'Communities', player.extra.community, 'https://plus.google.com/communities/'

        if Object.has player.extra, 'event'
            if not Array.isArray player.extra.event
                player.extra.event = [ player.extra.event ]

            $profile.append profileHelper.createLinkedSubtitle 'Events', player.extra.event, 'https://plus.google.com/event/'

        if Object.has(player, 'err') and not (Array.isArray(player.err) and player.err.length == 0)
            if not Array.isArray player.err
                player.err = [ player.err ]

            $profile.append profileHelper.createSubtitle 'Errors', $ player.err.map (e) ->
                $ '<div class="fIa s"></div>'
                    .text e
                    [0]

        customExtra.keys().filter (e) ->
                v = customExtra[e]

                Array.isArray(v) and 1 < v.count (e) -> Object.isString(e)
            .each (name) ->
                $profile.append profileHelper.createSubtitle name.humanize().pluralize(), $ customExtra[name].map (value) ->
                    $ '<div class="fIa s"></div>'
                        .text value
                        [0]
    checkProfile = ->
        $tabs = $ '#contentPane div[role="tabpanel"]'
        dot = doOnceTimestamp

        if $tabs.length == 0
            # not a profile!
            return

        oid = $tabs.first().attr 'id'
        oid = oid.to oid.indexOf '-'

        if oid.length != 21
            module.log.error 'Invalid oid: %s', oid
            return

        # we use $root as timestamp if the user doesn't exist,
        # and $elem if he does

        $root = $ '#' + oid + '-about-page'
        $elem = $root.find 'div.iidentity-profile-wrapper'

        if dot == $root.attr 'data-iidentity'
            # already checked, user is not a player...
            return

        if $elem.length > 0 and dot == $elem.attr 'data-iidentity'
            # already checked, user is a player
            return

        # set on root to stop duplicate calls
        $root.attr 'data-iidentity', dot

        module.log.log 'Checking if player with oid %s exists', oid
        module.comm.getPlayer oid, (err, player) ->
            if dot != $root.attr 'data-iidentity'
                # we got an update!
                # abort, we don't want to get in its way
                return

            if err
                # leave the timestamp on $root

                if err == 'not-found'
                    module.log.log 'No such player found'
                    return

                module.log.error err
                return

            module.log.log 'Player found: ', player

            if $elem.length == 0
                module.log.log 'Creating profile wrapper'
                $elem = profileHelper.createWrapper()
                $root.find 'div.Ypa.jw.am'
                    .last()
                    .prepend $elem
            else
                module.log.log 'Re-using existing profile wrapper'

            # switch to $elem for timestamping
            $elem.attr 'data-iidentity', dot
            $root.attr 'data-iidentity', null

            createProfile player, $elem

    checkEvent = ->
        $elem = $ '[token]'

        if $elem.length == 0
            str = window.document.location.pathname
        else
            str = $elem.first().attr 'token'

        if not (match = str.match /(^|\/)events\/([a-zA-Z0-9]+)$/)
            return

        oid = match[2]

        doOnce $('div.Ee.fP.Ue.eZ'), ($parent) ->
            module.comm.getSourcesForExtra 'event', oid, (sources) ->
                module.log.log 'Sources for this event (oid=%s): ', oid
                module.log.log sources

                $parent.find '.iidentity-event'
                    .remove()

                if sources == null or not Array.isArray(sources) or sources.length == 0
                    return

                $parent.find 'div.pD'
                    .after(
                        $ '<div class="pD iidentity-event"></pd>'
                            .append(
                                $ '<b>'
                                    .text 'IngressIdentity Source Files'
                            )
                            .append(
                                $ sources.map (source) ->
                                    $ '<div>'
                                        .append(
                                            $ '<a>'
                                                .addClass 'Ub'
                                                .attr 'href', source.url
                                                .attr 'target', '_blank'
                                                .text source.key
                                        )[0]
                            )
                    )

    checkCommunity = ->
        if not (match = window.document.location.pathname.match /(^|\/)communities\/([a-zA-Z0-9]+)$/)
            return

        oid = match[2]

        doOnce $('div.MZd.uTc'), ($parent) ->
            module.comm.getSourcesForExtra 'community', oid, (sources) ->
                module.log.log 'Sources for this community (oid=%s): ', oid
                module.log.log sources

                $parent.find '.iidentity-community'
                    .remove()

                if sources == null or not Array.isArray(sources) or sources.length == 0
                    return

                $parent.find 'div.LEd'
                    .before(
                        $ '<div class="g0d iidentity-community"></pd>'
                            .append(
                                $ '<b>'
                                    .text 'IngressIdentity Source Files'
                            )
                            .append(
                                $ sources.map (source) ->
                                        $ '<div>'
                                            .append(
                                                $ '<a>'
                                                    .addClass 'Ub'
                                                    .attr 'href', source.url
                                                    .attr 'target', '_blank'
                                                    .text source.key
                                            )[0]
                            )
                    )

    observer = new window.MutationObserver (mutations) ->
        checkProfile();
        checkEvent();
        checkCommunity();

        mutations.each (mutation) ->
            for i in [0..mutation.addedNodes.length-1]
                checkElement mutation.addedNodes[i]

    forceUpdate = ->
        doOnceTimestamp = '' + +new Date

        checkProfile()
        checkEvent()
        checkCommunity()

        checkElement window.document

    module.comm.setOnUpdate forceUpdate

    $ ->
        setTimeout ->
            forceUpdate()
            observer.observe window.document, { childList: true, subtree: true }
        , 0

)(window.iidentity = (window.iidentity || {}), window.jQuery, window)
