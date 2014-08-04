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
                            .append(
                                if window.document.location.pathname.match /(^|\/)communities\/([a-zA-Z0-9]+)\/members($|\/)/
                                    $ '<div>'
                                        .append(
                                            $ '<a>'
                                                .addClass 'Ub iidentity-export'
                                                .attr 'href', '#'
                                                .text 'Export this Community'
                                        )
                                else
                                    null
                            )
                    )

                $ 'a.iidentity-export'
                    .on 'click', ->
                        data =
                            oid: oid
                            entries: []

                        $ 'div.X8c.xTc'
                            .each ->
                                $this = $ @
                                data.entries.push
                                    oid: $this.attr 'oid'
                                    name: $this.find('.l0d > .n0d .VCc').text()

                        module.comm.send
                            type: 'setExportData'
                            data: data

                        module.extension.openPopup module.extension.getURL 'export.html'

                        false

    module.listSources = ->
        checkEvent()
        checkCommunity()
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
