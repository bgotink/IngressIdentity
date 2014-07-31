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

            if options.shouldShowHeader()
                lines.push "oid\tname\tnickname\tlevel"
                lines.push "999999999999999999999\tdummy\tdummy\t0"

            l = data.length

            data.each (entry, i) ->
                progress.export.set i, l

                line = "{oid}\t{name}".assign entry

                if Object.has entry, 'nickname'
                    line += "\t" + entry.nickname

                lines.push line

            $ '#export_result'
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

        $ 'button'
            .on 'click', ->
                $this = $ @

                if $this.hasClass 'active'
                    $this
                        .removeClass 'active'
                        .text 'Disabled'
                else
                    $this
                        .addClass 'active'
                        .text 'Enabled'

                doExport $this.hasClass 'requires-reparse'

        module.comm.send { type: 'getExportData' }, (result) ->
            rawData = result.data

            doExport true

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
