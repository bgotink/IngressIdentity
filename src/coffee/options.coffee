# The main script for the options page
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    comm =
        getManifests: (callback) ->
            module.comm.send { type: 'getManifests' }, (result) ->
                callback result
        getManifestErrors: (callback) ->
            module.comm.send { type: 'getManifestErrors' }, (result) ->
                callback result
        addManifest: (key, name, callback) ->
            module.comm.send { type: 'addManifest', key: key, name: (if Object.isString(name) then name else '') }, (result) ->
                callback result.status
        renameManifest: (key, oldName, newName, callback) ->
            module.comm.send {type: 'renameManifest', key: key, oldName: oldName, newName: newName}, (result) ->
                callback result.status
        removeManifest: (key, callback) ->
            module.comm.send { type: 'removeManifest', key: key }, (result) ->
                callback result.status

        changeManifestOrder: (oldOrder, newOrder, callback) ->
            module.comm.send { type: 'changeManifestOrder', oldOrder: oldOrder, newOrder: newOrder }, (result) ->
                callback result.status

        reloadData: (callback) ->
            module.comm.send { type: 'reloadData' }, (result) ->
                callback result.status

        setOption: (option, value, callback) ->
            module.comm.send { type: 'setOption', option: option, value: value }, (result) ->
                callback result.result
        getOption: (option, defaultValue, callback) ->
            module.comm.send { type: 'getOption', option: option, defaultValue: defaultValue }, (result) ->
                callback result.value

    showAlert = (id) ->
        module.log.log 'showing alert %s', id
        $ '.alert'
            .addClass 'hide'
        $ '.alert-' + id
            .removeClass 'hide'

    lastOrderRecorded = []
    onOrderChanged = ->
        newOrder = $.makeArray $('#source_list > ul > li').map ->
                $ @
                    .attr 'data-key'
        length = lastOrderRecorded.length
        updated = false

        if newOrder.length isnt length
            # abort, strange things are happening
            return

        for i in [0..length-1]
            if newOrder[i] isnt lastOrderRecorded[i]
                updated = true
                break

        if updated
            comm.changeManifestOrder lastOrderRecorded, newOrder, (status) ->
                showAlert 'reorder-' + status

            lastOrderRecorded = newOrder

    reloadManifestErrors = ->
        return if $('#source_list > ul').data 'errors-loaded'

        $ '#source_list > ul'
            .data 'errors-loaded', true

        module.log.log 'Reloading manifest errors...'
        comm.getManifestErrors (result) ->
            module.log.log 'Got manifest errors: ', result

            reloadManifestErrors.helper result, $ '#source_list > ul'
    reloadManifestErrors.helper = (errors, $elem) ->
        if Array.isArray errors
            $elem
                .find '> p.error'
                .remove()

            errors.each (err) ->
                if err.match(/Sign in/i) and err.substr(0, 2) is '<a' and err.substr(-4) is '</a>'
                    $elem.append $('<p class="error">').append $ err
                else
                    $elem.append $('<p class="error">').text err
        else
            Object.each errors, (key, value) ->
                if key is '__errors'
                    $ '<div class="panel-body" data-key="__errors">'
                        .insertBefore $elem.find '> .panel > .list-group'

                reloadManifestErrors.helper value, $elem.find '[data-key="' + key + '"]'

    reloadManifests = ->
        module.log.log 'Reloading manifests...'
        comm.getManifests (result) ->
            manifestList = []

            module.log.log 'Got manifest info: ', result

            if Object.isEmpty result
                $ '#source_list'
                    .html ''
                    .append(
                        $ '<p>'
                            .text module._ 'empty_1', 'No manifests loaded right now, try adding some!'
                    )
                    .append(
                        $ '<p>'
                            .text module._ 'empty_2', 'If you have just reloaded the extension, the manifests will automatically be shown here when the data is ready.'
                    )
                    .append(
                        $ '<p>'
                            .text module._ 'empty_3', 'If you believe this is in error, try reloading this page or pressing "Force reload".'
                    )

                return

            Object.each result, (key, value) ->
                sourceList = []

                module.log.log 'Manifest key %s', key
                module.log.log value

                value.sources.each (source) ->
                    module.log.log '-- Source key %s', source.key

                    sourceList.push($ '<li>'
                        .addClass 'list-group-item source faction-' + source.faction
                        .attr 'data-key', source.key
                        .append if source.url
                                $ '<a>'
                                    .text source.tag
                                    .attr 'target', '_blank'
                                    .attr 'href', source.url
                            else
                                $ '<span>'
                                    .text source.tag
                        .append($ '<p>'
                            .text module._('manifest_info', 'Faction: {faction}, {count} players, version {version}').assign source
                        )
                    )

                manifestList.push($ '<li>'
                    .addClass 'manifest'
                    .data 'key', key
                    .attr 'data-key', key
                    .append(
                        $ '<div class="panel panel-default"></div>'
                            .append(
                                $ '<div class="panel-heading"></div>'
                                    .append(
                                        $ '<span class="key-container"></span>'
                                            .append if value.url
                                                    $ '<a>'
                                                        .text if Object.isString(value.name) and not value.name.isBlank() then value.name else key
                                                        .attr 'target', '_blank'
                                                        .attr 'href', value.url
                                                        .addClass 'manifest-key'
                                                else
                                                    $ '<span>'
                                                        .text if Object.isString(value.name) and not value.name.isBlank() then value.name else key
                                                        .addClass 'manifest-key'
                                    )
                                    .append(
                                        $ '<span>'
                                            .addClass 'buttons'
                                            .append(
                                                if not value.url? then null else ($ '<a>'
                                                    .attr 'aria-hidden', 'true'
                                                    .attr 'title', module._('view', 'View')
                                                    .attr 'href', value.url
                                                    .attr 'target', '_blank'
                                                    .addClass 'link'
                                                    .append $ '<span class="glyphicon glyphicon-link"></span>'
                                                )
                                            )
                                            .append(
                                                $ '<button>'
                                                    .attr 'type', 'button'
                                                    .attr 'aria-hidden', 'true'
                                                    .attr 'title', module._('rename', 'Rename')
                                                    .addClass 'rename'
                                                    .append $ '<span class="glyphicon glyphicon-pencil"></span>'
                                            )
                                            .append(
                                                $ '<button>'
                                                    .attr 'type', 'button'
                                                    .attr 'aria-hidden', 'true'
                                                    .attr 'title', module._('remove', 'Remove')
                                                    .addClass 'remove'
                                                    .append $ '<span class="glyphicon glyphicon-remove"></span>'
                                            )
                                    )
                            )
                            .append(
                                $ '<ul>'
                                    .addClass 'list-group'
                                    .append sourceList
                            )
                    )
                )

            $ '#source_list'
                .html ''
                .append(
                    $ '<ul>'
                        .addClass 'list-unstyled'
                        .append manifestList
                )
            $ '#reload_sources'
                .button 'reset'

            lastOrderRecorded = $.makeArray(
                $ '#source_list > ul > li'
                    .map ->
                        $ @
                            .attr 'data-key'
            )
            $ '#source_list > ul'
                .sortable {
                    axis: 'y'
                    containment: 'parent'
                    cursor: '-webkit-grabbing'
                    distance: 5
                    revert: true
                    stop: onOrderChanged
                }
            $ '#source_list > ul'
                .disableSelection()

            reloadManifestErrors();

    updateButtons = ->
        comm.getOption 'show-anomalies', true, (state) ->
            if state
                $ '#enable_anomalies'
                    .addClass 'active'
                    .text module._('enabled', 'Enabled')
            else
                $ '#enable_anomalies'
                    .removeClass 'active'
                    .text module._('disabled', 'Disabled')

        $ 'button[data-match]'
            .each ->
                $this = $ @

                comm.getOption 'match-' + $this.attr('data-match'), true, (state) ->
                    if state
                        $this
                            .addClass 'active'
                            .text module._('enabled', 'Enabled')
                    else
                        $this
                            .removeClass 'active'
                            .text module._('disabled', 'Disabled')

    addManifest = ->
        module.log.log 'Adding manifest %s', $('#manifest_input').val()

        $ '#manifest_input'
            .attr 'disabled', true
        $ '#name_input'
            .attr 'disabled', true
        $ 'button.manifest_add'
            .button 'loading'

        comm.addManifest $('#manifest_input').val(), $('#name_input').val(), (result) ->
            if result isnt 'failed'
                $ '#manifest_input'
                    .val ''
                $ '#name_input'
                    .val ''

            $ '#manifest_input'
                .attr 'disabled', false
            $ '#name_input'
                .attr 'disabled', false
            $ 'button.manifest_add'
                .button 'reset'

            showAlert 'add-' + result

    $ ->
        module.extension.init() if module.extension.init?

        $ '.alert .close'
            .on 'click.ii.close', ->
                $ @
                    .parent()
                    .addClass 'hide'

        $ '#reload_sources'
            .on 'click.ii.reload', ->
                $this = $ @

                $this.button 'loading'

                comm.reloadData (result) ->
                    showAlert 'reload-' + result
                    $this.button 'reset'

        $ 'button.manifest_add'
            .on 'click.ii.add', addManifest
        $ 'form.manifest_add'
            .on 'submit.ii.add', ->
                addManifest()

                false

        # make enter submit a form
        $ 'input[type="text"]'
            .on 'keypress', (e) ->
                if e.which is 13
                    $ @
                        .closest 'form'
                        .submit()

                    false

        $ '#source_list'
            .on 'click.ii.remove', '.manifest .remove', ->
                comm.removeManifest $(@).closest('.manifest').data('key'), (result) ->
                        showAlert 'remove-' + result

        $ '#source_list'
            .on 'click.ii.rename', '.manifest .rename', ->
                $this = $ @
                $manifest = $this.closest '.manifest'
                $key = $manifest.find '.manifest-key'

                if $key.hasClass 'form-control'
                    # already done...
                    return

                module.log.log 'Creating input to rename manifest %s', $key.text()

                $key.replaceWith($ '<input type="text" class="form-control manifest-key"></input>'
                    .val if $key.text() is $manifest.data 'key' then '' else $key.text()
                    .data 'old-name', $key.text()
                    .data 'url', if 'A' is $key.prop 'tagName' then $key.attr 'href' else null
                )

        $ '#source_list'
            .on 'keypress', 'input.manifest-key', (e) ->
                if e.which isnt 13
                    return

                $this = $ @
                $manifest = $this.closest '.manifest'
                key = $manifest.data 'key'
                oldName = $this.data 'old-name'
                newName = $this.val()

                if oldName.compact() isnt newName.compact()
                    if newName.isBlank()
                        newName = null

                    if oldName.compact() is key.compact()
                        oldName = null

                    module.log.log 'Renaming manifest %s from %s to %s', key, oldName, if newName != null then newName else ''

                    comm.renameManifest key, oldName, newName, (status) ->
                        showAlert 'rename-' + status

                if Object.isString $this.data 'url'
                    $replacement = $ '<a target="_blank">'
                        .attr 'href', $this.data 'url'
                else
                    $replacement = $ '<p>'

                $replacement.text if $this.val().isBlank() then key else $this.val()
                    .addClass 'manifest-key'

                $this.replaceWith $replacement

                false

        reloadManifests()

        $ '#enable_anomalies'
            .on 'click.set-option', ->
                $this = $ @
                $this
                    .button 'loading'
                    .addClass 'disable-hover'

                comm.setOption 'show-anomalies', !$this.hasClass('active'), (state) ->
                    if state
                        $this
                            .addClass 'active'
                            .text module._('enabled', 'Enabled')
                    else
                        $this
                            .removeClass 'active'
                            .text module._('disabled', 'Disabled')

                    $this
                        .button 'reset'
                        .removeClass 'disable-hover'

        $ 'button[data-match]'
            .on 'click.set-option', ->
                $this = $ @
                $this
                    .button 'loading'
                    .addClass 'disable-hover'

                comm.setOption 'match-' + $this.attr('data-match'), !$this.hasClass('active'), (state) ->
                    if state
                        $this
                            .addClass 'active'
                            .text module._('enabled', 'Enabled')
                    else
                        $this
                            .removeClass 'active'
                            .text module._('disabled', 'Disabled')

                    $this
                        .button 'reset'
                        .removeClass 'disable-hover'

        [ $('#enable_anomalies'), $('button[data-match]') ].each ($buttons) ->
            $buttons
                .on 'mouseenter', () ->
                    $this = $ @

                    return if $this.hasClass 'disable-hover'

                    if $this.hasClass 'active'
                        $this.text module._('disabled', 'Disabled')
                    else
                        $this.text module._('enabled', 'Enabled')
                .on 'mouseleave', () ->
                    $this = $ @

                    return if $this.hasClass 'disable-hover'

                    if $this.hasClass 'active'
                        $this.text module._('enabled', 'Enabled')
                    else
                        $this.text module._('disabled', 'Disabled')

        updateButtons()

        module.comm.setOnUpdate ->
            reloadManifests()
            updateButtons()
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
