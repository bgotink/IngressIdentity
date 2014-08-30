# Shows the manifests and allows manipulation.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
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
            module.comm.changeManifestOrder lastOrderRecorded, newOrder, (status) ->
                module.showAlert 'reorder-' + status

            lastOrderRecorded = newOrder

    reloadManifestErrors = ->
        return if $('#source_list > ul').data 'errors-loaded'

        $ '#source_list > ul'
            .data 'errors-loaded', true

        module.log.log 'Reloading manifest errors...'
        module.comm.getManifestErrors (result) ->
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
        module.comm.getManifests (result) ->
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
                                            .append(
                                                $ '<span>'
                                                    .text if Object.isString(value.name) and not value.name.isBlank() then value.name else key
                                                    .addClass 'manifest-key'
                                            )
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
                    handle: '.panel-heading'
                    cursor: '-webkit-grabbing'
                    distance: 5
                    revert: true
                    stop: onOrderChanged
                }
            $ '#source_list .panel-heading'
                .disableSelection()

            reloadManifestErrors()

    addManifest = ->
        module.log.log 'Adding manifest %s', $('#manifest_input').val()

        $ '#manifest_input'
            .attr 'disabled', true
        $ '#name_input'
            .attr 'disabled', true
        $ 'button.manifest_add'
            .button 'loading'

        module.comm.addManifest $('#manifest_input').val(), $('#name_input').val(), (result) ->
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

            module.showAlert 'add-' + result

    module.reloadManifests = reloadManifests

    module.initManifests = ->
        $ 'button.manifest_add'
            .on 'click.ii.add', addManifest
        $ 'form.manifest_add'
            .on 'submit.ii.add', ->
                addManifest()

                false

        $ '#source_list'
            .on 'click.ii.remove', '.manifest .remove', ->
                module.comm.removeManifest $(@).closest('.manifest').data('key'), (result) ->
                    module.showAlert 'remove-' + result

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

                    module.comm.renameManifest key, oldName, newName, (status) ->
                        module.showAlert 'rename-' + status

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
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
