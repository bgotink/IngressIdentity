# Extends the communication functions for the options page
# Note: must be loaded _after_ the base communications script.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->

    if not module.comm?
        throw new Error 'Cannot extend the communication object if it hasn\'t been created yet.'

    module.comm.getManifests = (callback) ->
        @send { type: 'getManifests' }, (result) ->
            callback result
    module.comm.getManifestErrors = (callback) ->
        @send { type: 'getManifestErrors' }, (result) ->
            callback result
    module.comm.addManifest = (key, name, callback) ->
        @send { type: 'addManifest', key: key, name: (if Object.isString(name) then name else '') }, (result) ->
            callback result.status
    module.comm.renameManifest = (key, oldName, newName, callback) ->
        @send {type: 'renameManifest', key: key, oldName: oldName, newName: newName}, (result) ->
            callback result.status
    module.comm.removeManifest = (key, callback) ->
        @send { type: 'removeManifest', key: key }, (result) ->
            callback result.status

    module.comm.changeManifestOrder = (oldOrder, newOrder, callback) ->
        @send { type: 'changeManifestOrder', oldOrder: oldOrder, newOrder: newOrder }, (result) ->
            callback result.status

    module.comm.reloadData = (callback) ->
        @send { type: 'reloadData' }, (result) ->
            callback result.status

    module.comm.setOption = (option, value, callback) ->
        @send { type: 'setOption', option: option, value: value }, (result) ->
            callback result.result
    module.comm.getOption = (option, defaultValue, callback) ->
        @send { type: 'getOption', option: option, defaultValue: defaultValue }, (result) ->
            callback result.value

)(iidentity or (iidentity = window.iidentity = {}))
