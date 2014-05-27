# Check if profile page and act accordingly
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    helper =
        createWrapper: ->
            return $ '''
                    <div class="Ee h5a vna iidentity-profile-wrapper" role="article">
                        <div class="ZYa ukoEtf">
                            <div class="Lqc">
                                <div class="F9a">Ingress Agent Profile</div>
                                <div class="miIoOb Cdmn9d"></div>
                            </div>
                        </div>
                        <div class="Uia"><div class="iec Iqc iidentity-profile"></div></div>
                        <div class="Iqc"></div>
                    </div>
                    '''

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
            helper.createSubtitle subtitle, $ links.map (link) ->
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

    create = (player, wrapper) ->
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
                helper.createTable(
                    [
                        helper.createRow 'Agent name', player.nickname
                        helper.createRow 'Level', 'L' + (if level == '0' then '?' else level)
                        helper.createRow 'Faction', player.faction.capitalize()
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

                            helper.createRow e.humanize(), (if Array.isArray(v) then v[0] else v).compact().capitalize()
                    )
                )
            )

        if Object.has player.extra, 'anomaly'
            if not Array.isArray player.extra.anomaly
                player.extra.anomaly = [ player.extra.anomaly ]

            $profile.append helper.createAnomalySubtitle player.extra.anomaly

        if Object.has player.extra, 'community'
            if not Array.isArray player.extra.community
                player.extra.community = [ player.extra.community ]

            $profile.append helper.createLinkedSubtitle 'Communities', player.extra.community, 'https://plus.google.com/communities/'

        if Object.has player.extra, 'event'
            if not Array.isArray player.extra.event
                player.extra.event = [ player.extra.event ]

            $profile.append helper.createLinkedSubtitle 'Events', player.extra.event, 'https://plus.google.com/event/'

        if Object.has(player, 'err') and not (Array.isArray(player.err) and player.err.length == 0)
            if not Array.isArray player.err
                player.err = [ player.err ]

            $profile.append helper.createSubtitle 'Errors', $ player.err.map (e) ->
                $ '<div class="fIa s"></div>'
                    .text e
                    [0]

        customExtra.keys().filter (e) ->
                v = customExtra[e]

                Array.isArray(v) and 1 < v.count (e) -> Object.isString(e)
            .each (name) ->
                $profile.append helper.createSubtitle name.humanize().pluralize(), $ customExtra[name].map (value) ->
                    $ '<div class="fIa s"></div>'
                        .text value
                        [0]

    module.checkProfile = ->
        module.log.log 'checkProfile!'

        $tabs = $ '#contentPane div[role="tabpanel"]'
        dot = module.doOnce.timestamp()

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
                $elem = helper.createWrapper()
                $root.find 'div.Ypa.jw.am'
                    .last()
                    .prepend $elem
            else
                module.log.log 'Re-using existing profile wrapper'

            # switch to $elem for timestamping
            $elem.attr 'data-iidentity', dot
            $root.attr 'data-iidentity', null

            createProfile player, $elem
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
