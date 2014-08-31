# Gets and stores the settings
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    updateSettings = ->
        $ 'input[data-match]'
            .each ->
                self = @

                module.comm.getOption 'match-' + $(@).attr('data-match'), true, (state) ->
                    self.checked = state

        $ 'input[data-show]'
            .each ->
                self = @
                attr = $ @
                    .attr 'data-show'

                module.comm.getOption 'show-' + attr, (attr isnt 'hide-self'), (state) ->
                    self.checked = state

                    if attr is 'hide-self'
                        $ '.own-oid > input, .own-oid button'
                            .prop 'disabled', !state

        module.comm.getOption 'own-oid', '', (oid) ->
            $ '.own-oid > input'
                .val oid

    saveName = ->
        return unless $('input.hide-self').is ':checked'

        $oid = $ '.own-oid > input'

        $ '.own-oid > input, .own-oid button'
            .prop 'disabled', true

        module.comm.setOption 'own-oid', $oid.val(), (oid) ->
            $oid.val oid

            $ '.own-oid > input, .own-oid button'
                .prop 'disabled', false

    module.updateSettings = updateSettings

    module.initSettings = ->
        $ 'input[data-match]'
            .on 'change', ->
                $this = $ @
                self = @

                newState = @.checked

                $this.prop 'disabled', true

                module.comm.setOption 'match-' + $this.attr('data-match'), newState, (state) ->
                    $this.prop 'disabled', false

                    if state isnt newState
                        # something went wrong :(
                        self.checked = state

        $ 'input[data-show]'
            .on 'change', ->
                $this = $ @
                self = @

                attr = $this.attr 'data-show'
                newState = @.checked

                $this.prop 'disabled', true

                module.comm.setOption 'show-' + attr, newState, (state) ->
                    $this.prop 'disabled', false

                    if state isnt newState
                        # something went wrong :(
                        self.checked = state
                        return

                    if attr is 'hide-self'
                        $ '.own-oid > input, .own-oid button'
                            .prop 'disabled', !state

        $ '.own-oid button'
            .on 'click', saveName
        $ '.own-oid > input'
            .on 'keypress', (e) ->
                if e.which is 13
                    saveName()

                    false

        updateSettings()
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
