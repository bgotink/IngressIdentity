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

        oid = match[2]

        return unless $('.iidentity-export').length is 0

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

                module.showPopup 'Export Community', 'gray', module.extension.getURL 'export.html'

                false

    module.addExport = addExport
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery, window)
