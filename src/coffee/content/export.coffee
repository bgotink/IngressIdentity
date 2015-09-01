# shows an export button in communities
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $, window) ->
    addExport = ->
        if not match = window.document.location.pathname.match /(^|\/)communities\/([a-zA-Z0-9]+)\/members($|\/)/
            $ '.iidentity-export'
                .remove()
            return

        communityOid = match[2]

        module.comm.shouldShowExport (show) ->
            if not show
                $ '.iidentity-export'
                    .remove()
                return
            else if $('.iidentity-export').length isnt 0
                return

            $ 'div.WZd.wTc'
                .append $ '''
                <a href="#export" class="d-s ob UCc eke iidentity-export" tabindex="0">
                    <div class="TZd SZd">
                        <span class="VZd NEd">Export to IngressIdentity</span>
                    </div>
                </a>
                          '''

            $ '.iidentity-export'
                .on 'click', ->
                    $loadMore = $ 'span.L5'

                    data =
                        oid: communityOid
                        showWarning: $loadMore.length isnt 0 and 'none' isnt $loadMore.css 'display'
                        entries: []

                    $ 'div.X8c.xTc'
                        .each ->
                            $this = $ @

                            if $this.is '[oid]'
                                oid = $this.attr 'oid'
                            else
                                $oidCarrier = $this.find '[oid]'

                                return unless $oidCarrier.length > 0

                                oid = $oidCarrier.first().attr 'oid'

                            data.entries.push
                                oid: oid
                                name: $this.find('.l0d > .n0d .VCc').text()

                    module.comm.send
                        type: 'setExportData'
                        data: data

                    module.showPopup 'Export Community', 'gray', module.extension.getURL 'export.html'

                    false

    module.addExport = addExport
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
