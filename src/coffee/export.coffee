# The main script for the export page
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    rawData = null
    data = null

    options =
        shouldExtractName: ->
            $ '#btn_extract_name'
                .hasClass 'active'
        shouldRemoveExisting: ->
            $ '#btn_remove_existing'
                .hasClass 'active'
        shouldShowHeader: ->
            $ '#btn_show_header'
                .hasClass 'active'

    nameRegexes = [
        /\(([^)]+)\)/                # FirstName LastName (Nickname)
        /"([^"]+)"/                  # FirstName "Nickname" LastName
        /\u201C([^\u201D]+)\u201D/   # FirstName “Nickname” LastName
        /\u2018([^\u2019]+)\u2019/   # FirstName ‘Nickname’ LastName
        /\s+a\.?k\.?a\.?\s+(.*)$/    # FirstName LastName a.k.a. Nickname
    ]

    class Modal
        constructor: (name) ->
            @$this = $ name
        show: ->
            @$this.modal 'show'
        hide: ->
            # delay hide to give progress bar time to fill
            window.setTimeout (=> @$this.modal('hide')), 500

    class Progress
        constructor: (name) ->
            @$this = $ name
        set: (value, total) ->
            percent = Math.round value / total * 100

            @$this
                .attr 'aria-valuenow', percent
                .css 'width', percent + '%'
                .find 'span.sr-only percent'
                    .text percent
        reset: -> @set 0, 1

    modals = null
    progress = null

    createExportTableRow = (oid, name, nickname = '', level = '', header = false) ->
        cell = if header then 'th' else 'td'

        $ """
            <tr>
                <#{ cell }>#{ oid }</#{ cell }>
                <#{ cell }>#{ name }</#{ cell }>
                <#{ cell }>#{ nickname }</#{ cell }>
                <#{ cell }>#{ level }</#{ cell }>
            </tr>
          """

    parseName = (entry, callback) ->
        module.comm.getPlayer entry.oid, (err, player) ->
            if player?.nickname?
                entry.name = player.name
                # entry.nickname = player.nickname
            else
                nameRegexes.each (re) ->
                    matches = false
                    if matches = entry.name.match re
                        entry.nickname = matches[1].compact()
                        entry.name = entry.name.remove(re).compact()

                        false

            callback()

    parseHelper = (i, l, extractName, removeExisting, callback) ->
        # call callback when done
        if i >= l
            callback()
            return

        progress.parse.set i + 1, l

        # do stuff
        rawEntry = rawData.entries[i]
        entry =
            oid: rawEntry.oid
            name: rawEntry.name

        doParseHelper = (addPlayer) ->
            goToNextStep = ->
                parseHelper i + 1, l, extractName, removeExisting, callback

            if not addPlayer
                goToNextStep()
            else
                if extractName
                    parseName entry, () ->
                        data.push entry
                        goToNextStep()
                else
                    data.push entry
                    goToNextStep()

        if removeExisting
            module.comm.getPlayer entry.oid, (err, player) ->
                module.log.error err if err? and err isnt 'not-found'

                if not removeExisting or not player?.extra?.community?
                    doParseHelper true
                else
                    communities = player.extra.community
                    communities = [ communities ] unless Array.isArray communities

                    found = false
                    communities.each (community) ->
                        if rawData.oid is community.to(community.indexOf ':').compact()
                            found = true
                            false

                    doParseHelper !found
        else
            doParseHelper true

    parse = (callback) ->
        data = []

        parseHelper 0, rawData.entries.length, options.shouldExtractName(), options.shouldRemoveExisting(), callback

    doExport = (doParse) ->
        doExportHelper = ->
            lines = []
            $shownResult = $ '.table.result'

            # remove previous result
            $shownResult.empty()

            # add header
            $shownResult
                .append createExportTableRow 'oid', 'name', 'nickname', 'level', true

            if options.shouldShowHeader()
                lines.push "oid\tname\tnickname\tlevel"
                lines.push "999999999999999999999\tdummy\tdummy\t0"

                $shownResult
                    .append createExportTableRow '999999999999999999999', 'dummy', 'dummy', '0', true

            l = data.length

            data.each (entry, i) ->
                progress.export.set i, l

                line = "{oid}\t{name}".assign entry

                if Object.has entry, 'nickname'
                    line += "\t" + entry.nickname

                lines.push line
                $shownResult.append createExportTableRow entry.oid, entry.name, entry.nickname or null

            $ '.export.result'
                .text lines.join "\n"

            modals.parse_export.hide()
            modals.export.hide()

        if doParse
            progress.parse.reset()
            progress.export.reset()

            modals.parse_export.show()

            parse doExportHelper
        else
            progress.export.reset()

            modals.export.show()

            doExportHelper()

    $ ->
        modals =
            export: new Modal '#modal_export'
            parse_export: new Modal '#modal_parse_export'

        progress =
            parse: new Progress '.progress-bar.parse'
            export: new Progress '.progress-bar.export'

        $ 'button.setting'
            .on 'click', ->
                $this = $ @

                if $this.hasClass 'active'
                    $this
                        .removeClass 'active'
                        .text module._ 'disabled', 'Disabled'
                else
                    $this
                        .addClass 'active'
                        .text module._ 'enabled', 'Enabled'

                doExport $this.hasClass 'requires-reparse'

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
            rawData = result.data

            if rawData.showWarning
                $ '.warning'
                    .removeClass 'hide'

            doExport true

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
