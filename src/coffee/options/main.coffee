# The main script for the options page
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    $ ->
        module.extension.init?()

        # make enter submit a form
        $ 'form input[type="text"]'
            .on 'keypress', (e) ->
                if e.which is 13
                    $ @
                        .closest 'form'
                        .submit()

                    false

        $ '#reload_sources'
            .on 'click', ->
                $this = $ @

                $this.button 'loading'

                module.comm.reloadData (result) ->
                    module.showAlert 'reload-' + result
                    $this.button 'reset'

        module.initManifests()
        module.initSettings()

        module.comm.setOnUpdate ->
            module.reloadManifests()
            module.updateSettings()
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
