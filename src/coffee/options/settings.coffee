# Gets and stores the settings
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    currentSettings =
        match: {}
        show: {}
        'own-oid': ''

    updateSettings = ->
        $ 'input[data-match]'
            .each ->
                self = @
                attr = $ @
                    .attr 'data-match'

                module.comm.getOption 'match-' + attr, true, (state) ->
                    self.checked = state
                    currentSettings.match[attr] = state

        $ 'input[data-show]'
            .each ->
                self = @
                attr = $ @
                    .attr 'data-show'

                module.comm.getOption 'show-' + attr, (attr isnt 'hide-self'), (state) ->
                    self.checked = state
                    currentSettings.show[attr] = state

                    if attr is 'hide-self'
                        $ '.own-oid > input'
                            .prop 'disabled', !state

        module.comm.getOption 'own-oid', '', (oid) ->
            $ '.own-oid > input'
                .val oid
            currentSettings['own-oid'] = oid

    findChangedOptions = ->
        newSettings =
            match: {}
            show: {}
            'own-oid': ''

        [ 'match', 'show' ].each (attr) ->
            $ 'input[data-' + attr + ']'
                .each ->
                    newSettings[attr][$(@).attr 'data-' + attr] = @.checked

                    # if @.checked is false, the auto-return of CoffeeScript will break the loop...
                    true

        newSettings['own-oid'] = $ '.own-oid > input'
            .val()

        module.log.log 'Old settings state', currentSettings, 'new settings state', newSettings

        if not newSettings.show['hide-self'] or currentSettings['own-oid'] is newSettings['own-oid']
            delete newSettings['own-oid']

        [ 'match', 'show' ].each (attr) ->
            Object.each currentSettings[attr], (key, value) ->
                if value is newSettings[attr][key]
                    delete newSettings[attr][key]

            if Object.isEmpty newSettings[attr]
                delete newSettings[attr]

        if Object.isEmpty newSettings
            module.log.log 'No settings have been changed'
            return false

        module.log.log 'Found changed settings:', newSettings
        newSettings

    save = ->
        changes = findChangedOptions()

        # return if there are no changes
        return if changes is false

        $button = $ '.settings button'
        $inputs = $ '.settings input'

        $button.prop 'disabled', true
        $inputs.prop 'disabled', true

        module.comm.setOptions changes, ->
            updateSettings()

            $button.prop 'disabled', false
            $inputs.prop 'disabled', false

    onSettingChanged = ->
        $ '.settings button'
            .prop 'disabled', (findChangedOptions() is false)

        $ '.own-oid input'
            .prop 'disabled', (not $('input[data-show="hide-self"]').is(':checked'))

    module.updateSettings = updateSettings

    module.initSettings = ->
        $ 'input[data-match], input[data-show]'
            .on 'change', onSettingChanged

        $ '.own-oid > input'
            .on 'change', onSettingChanged

        $ '.settings button'
            .on 'click', save

        updateSettings()
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
