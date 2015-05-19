# Check if profile page and act accordingly
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->

    # find the smallest of a list of elements
    # smallest = lowest height
    $.fn.smallest = ->
        return @ if @length is 0

        smallest = null
        smallestHeight = Infinity

        @each ->
            $this = $ @
            if $this.height() < smallestHeight
                smallestHeight = $this.height()
                smallest = $this

        smallest

    helper =
        createWrapper: ->
            $ """
              <div class="Ee h5a vna iidentity-profile-wrapper" role="article">
                  <div class="ZYa ukoEtf">
                      <div class="Lqc">
                          <div class="F9a">#{ module.i18n.getMessage 'profileTitle' }</div>
                          <div class="miIoOb Cdmn9d"></div>
                      </div>
                  </div>
                  <div class="Uia"><div class="iec Iqc iidentity-profile"></div></div>
                  <div class="Iqc"></div>
              </div>
              """

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
                    $ "<div class=\"Cr Aha\">#{ module.i18n.getMessage 'anomalies' }</div>"
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
                                                    .attr 'src', module.extension.getURL 'img/anomalies/' + anomaly + '.png'
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
                                                .append(@)[0]
                                )
                        )
                )
        createLinkedSubtitle: (subtitle, links, baseUrl) ->
            helper.createSubtitle subtitle, $ links.map (link) ->
                i = link.indexOf ':'
                return null if i is -1

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

        if player.faction is 'enlightened'
            $wrapper
                .removeClass 'Mqc'
                .addClass 'Hqc'
        else if player.faction is 'resistance'
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
            if Object.isString(player.level) and player.level.match /([0-9]|1[0-6])/
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
                        helper.createRow module.i18n.getMessage('agentName'), player.nickname
                        helper.createRow module.i18n.getMessage('level'), module.i18n.getMessage('levelValue', { value: (if level is '0' then '?' else level) })
                        helper.createRow module.i18n.getMessage('faction'), module.i18n.getMessage(player.faction)
                    ].concat(customExtra.keys()
                        .filter (e) ->
                            v = customExtra[e];

                            if Array.isArray v
                                return false unless v.length is 1

                                v = v[0]

                            Object.isString v
                        .map (e) ->
                            v = customExtra[e]

                            helper.createRow e.humanize(), (if Array.isArray v then v[0] else v).compact().capitalize()
                    )
                )
            )

        if Object.has player.extra, 'anomaly'
            unless Array.isArray player.extra.anomaly
                player.extra.anomaly = [ player.extra.anomaly ]

            $profile.append helper.createAnomalySubtitle player.extra.anomaly

        if Object.has player.extra, 'community'
            unless Array.isArray player.extra.community
                player.extra.community = [ player.extra.community ]

            $profile.append helper.createLinkedSubtitle module.i18n.getMessage('communities'), player.extra.community, 'https://plus.google.com/communities/'

        if Object.has player.extra, 'event'
            unless Array.isArray player.extra.event
                player.extra.event = [ player.extra.event ]

            $profile.append helper.createLinkedSubtitle module.i18n.getMessage('events'), player.extra.event, 'https://plus.google.com/events/'

        if Object.has(player, 'err') and not (Array.isArray(player.err) and player.err.length is 0)
            unless Array.isArray player.err
                player.err = [ player.err ]

            $profile.append helper.createSubtitle module.i18n.getMessage('errors'), $ player.err.map (e) ->
                $ '<div class="fIa s"></div>'
                    .text(e)[0]

        customExtra.keys().filter (e) ->
                v = customExtra[e]

                Array.isArray(v) and 1 < v.count (e) -> Object.isString(e)
            .each (name) ->
                $profile.append helper.createSubtitle name.humanize().pluralize(), $ customExtra[name].map (value) ->
                    $ '<div class="fIa s"></div>'
                        .text(value)[0]

    module.checkProfile = ->
        $tabs = $ '#contentPane div[role="tabpanel"]'
        dot = module.doOnce.timestamp()

        if $tabs.length is 0
            # not a profile!
            return

        oid = $tabs.first().attr 'id'
        oid = oid.to oid.indexOf '-'

        if oid.length isnt 21
            module.log.error 'Invalid oid: %s', oid
            return

        # we use $root as timestamp if the user doesn't exist,
        # and $elem if he does

        $root = $ '#' + oid + '-about-page'

        # own profile page uses slightly different IDs
        if $root.length is 0
            $root = $ '#' + oid + '-co-about-page'

        $elem = $root.find 'div.iidentity-profile-wrapper'

        if dot is $root.attr 'data-iidentity'
            # already checked, user is not a player...
            return

        if $elem.length > 0 and dot is $elem.attr 'data-iidentity'
            # already checked, user is a player
            return

        # set on root to stop duplicate calls
        $root.attr 'data-iidentity', dot

        module.log.log 'Checking if player with oid %s exists', oid
        module.comm.getPlayer oid, (err, player) ->
            if dot isnt $root.attr 'data-iidentity'
                # we got an update!
                # abort, we don't want to get in its way
                return

            if err?
                # leave the timestamp on $root

                if err is 'not-found'
                    module.log.log 'No such player found'
                    return

                module.log.error err
                return

            module.log.log 'Player found: ', player

            if $elem.length is 0
                module.log.log 'Creating profile wrapper'
                $elem = helper.createWrapper()
                $root.find 'div.Ypa.jw.am'
                    .smallest()
                    .prepend $elem
            else
                module.log.log 'Re-using existing profile wrapper'

            # switch to $elem for timestamping
            $elem.attr 'data-iidentity', dot
            $root.attr 'data-iidentity', null

            create player, $elem
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
