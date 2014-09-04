# Function to show an alert
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    module.showAlert = (id) ->
        module.log.log 'showing alert %s', id
        $ '.alert'
            .addClass 'hide'
        $ '.alert-' + id
            .removeClass 'hide'

    $ ->
        $ '.alert .close'
            .on 'click', ->
                $ @
                    .parent()
                    .addClass 'hide'
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
