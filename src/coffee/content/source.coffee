# function to list the source files connected to a community or event
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $, window) ->
    checkEvent = ->
        $elem = $ '[token]'

        if $elem.length is 0
            str = window.document.location.pathname
        else
            str = $elem.first().attr 'token'

        if not match = str.match /(^|\/)events\/([a-zA-Z0-9]+)$/
            return

        oid = match[2]

        module.doOnce $('div.Ee.fP.Ue.eZ'), ($parent) ->
            module.comm.getSourcesForExtra 'event', oid, (sources) ->
                module.log.log 'Sources for this event (oid=%s): ', oid
                module.log.log sources

                $parent.find '.iidentity-event'
                    .remove()

                if not sources? or not Array.isArray(sources) or sources.length is 0
                    return

                $parent.find 'div.pD'
                    .after(
                        $ '<div class="pD iidentity-event"></pd>'
                            .append(
                                $ '<b>'
                                    .text module.i18n.getMessage 'sourceFiles'
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
        if not match = window.document.location.pathname.match /(^|\/)communities\/([a-zA-Z0-9]+)($|\/)/
            return

        oid = match[2]

        module.doOnce $('div.MZd.uTc'), ($parent) ->
            module.comm.getSourcesForExtra 'community', oid, (sources) ->
                module.log.log 'Sources for this community (oid=%s): ', oid
                module.log.log sources

                $parent.find '.iidentity-community'
                    .remove()

                if not sources? or not Array.isArray(sources) or sources.length is 0
                    return

                $parent.find 'div.LEd'
                    .before(
                        $ '<div class="g0d iidentity-community">'
                            .append(
                                $ '<b>'
                                    .text module.i18n.getMessage 'sourceFiles'
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

    module.listSources = ->
        checkEvent()
        checkCommunity()
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
