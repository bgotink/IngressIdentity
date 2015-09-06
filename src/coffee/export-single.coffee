# The main script for the export page
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    rawData = null
    data = null

    nameRegexes = [
        /\(([^)]+)\)/                # FirstName LastName (Nickname)
        /"([^"]+)"/                  # FirstName "Nickname" LastName
        /\u201C([^\u201D]+)\u201D/   # FirstName “Nickname” LastName
        /\u2018([^\u2019]+)\u2019/   # FirstName ‘Nickname’ LastName
        /\s+a\.?k\.?a\.?\s+(.*)$/    # FirstName LastName a.k.a. Nickname
    ]

    createExportTableRow = (oid, name, nickname = '', header = false) ->
        cell = if header then 'th' else 'td'

        $ """
            <tr>
                <#{ cell }>#{ oid }</#{ cell }>
                <#{ cell }>#{ name }</#{ cell }>
                <#{ cell }>#{ nickname }</#{ cell }>
            </tr>
          """

    parseName = (data, callback) ->
        module.comm.getPlayer data.oid, (err, player) ->
                if player?.nickname?
                    data.name = player.name
                    data.nickname = player.nickname
                else
                    nameRegexes.each (re) ->
                        matches = false
                        if matches = data.name.match re
                            data.nickname = matches[1].compact()
                            data.name = data.name.remove(re).compact()

                            false

                callback()
            , { show_self: true }

    handleData = (data) ->
        lines = []
        $shownResult = $ '.table.result'

        # remove previous result
        $shownResult.empty()

        # add header
        $shownResult
            .append createExportTableRow 'oid', 'name', 'nickname', true

        parseName data, ->
            $shownResult.append createExportTableRow data.oid, data.name, data.nickname or null

            line = "{oid}\t{name}".assign data

            if Object.has data, 'nickname'
                line += "\t" + data.nickname

            $ '.export.result'
                .text line

    $ ->
        $ '#copy'
            .on 'click', ->
                $ '.export.result'
                    .focus()
                    .select()

                return false if module.extension.browser isnt 'firefox' and document.execCommand 'copy', false, null

                # automatic copy failed
                # fallback to hiding the table and showing a textarea
                $ '.table.result'
                    .empty()
                    .append(
                        $ '<textarea rows="30" columns="30">'
                            .text $('.export.result').text()
                    )

                false

        module.extension.init() if module.extension.init?

        module.comm.send { type: 'getExportData' }, (result) ->
            module.log.log 'Got export data', result.data

            handleData result.data

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
