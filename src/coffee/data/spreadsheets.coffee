# This file exports two classes to window.iidentity.spreadsheets in order to
# facilitate loading the two kinds of spreadsheets this extension uses.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    exports = (if Object.has module, 'data' then module.data else module.data = {}).spreadsheets = {}

    # variables & constants

    baseUrl =
        oldSheet: 'https://docs.google.com/spreadsheet/ccc?key={key}'
        newSheet: 'https://docs.google.com/spreadsheets/d/{key}'

    baseQueryUrl =
        oldSheet: 'https://docs.google.com/spreadsheet/ccc?key={key}&gid={gid}&access_token={token}'
        newSheet: 'https://docs.google.com/spreadsheets/d/{key}/gviz/tq?gid={gid}&access_token={token}'

    # unexported helper functions and classes

    checkKeyExists = (arr, key, err, row) ->
        if not key in arr or arr[key] is null or ('' + arr[key]).isBlank()
            err.push('Expected key ' + key + ' to exist in row ' + row)

    parseKey = (key) ->
        key = (key or '').compact()

        if (matches = key.match /(.*)[#&?]gid=(.*)/)
            {
                key: matches[1],
                gid: matches[2],
                token
            }
        else
            { key: key, token }

    keyToUrl = (key) ->
        if not Object.isObject key
            key = parseKey key

        if key.key.match /^[a-zA-Z0-9]+$/
            url = baseUrl.oldSheet.assign key
        else
            url = baseUrl.newSheet.assign key

        if Object.has key, 'gid'
            url + '#gid=' + key.gid
        else
            url

    # OAuth token

    token = undefined

    exports.setToken = (t) ->
        token = t

    # This class loads google drive documents.
    #
    # Before using this class, the google visualization library has to be loaded.
    class Spreadsheet
        # The constructor. The only parameter is the key/id of the spreadsheet.
        constructor: (key) ->
            @key = key.compact()

        # Get a URL to visit this spreadsheet
        getUrl: ->
            keyToUrl @key

        # Loads the raw document. The callbackfunction should be of the type
        #   function (err, data) {}
        # err  will be non-null if an error or warning occured.
        # data will be null only if an error occured, otherwise it will be an
        #      array containing the tuples in the spreadsheet
        loadRaw: (callback) ->
            key = parseKey @key

            if not Object.has key, 'gid'
                key.gid = 0

            if key.key.match /^[a-zA-Z0-9]+$/
                url = baseQueryUrl.oldSheet.assign key
            else
                url = baseQueryUrl.newSheet.assign key

            (new google.visualization.Query(url)).send (response) =>
                if response.isError()
                    module.log.error 'An error occured while fetching data from ' + @key, response
                    callback response.getDetailedMessage(), null
                    return

                err = if response.hasWarning() then response.getDetailedMessage() else null
                data = response.getDataTable()
                nbCols = data.getNumberOfColumns()
                nbRows = data.getNumberOfRows()
                headers = []
                result = []

                if nbCols is 0 or nbRows is 0
                    callback 'The spreadsheet is empty.', null
                    return

                for i in [0..nbCols-1]
                    headers[i] = data.getColumnLabel i

                for i in [0..nbRows-1]
                    tuple = {}
                    for j in [0..nbCols-1]
                        tuple[headers[j]] = data.getValue i, j
                    result.push tuple

                callback err, result

        # Checks whether the returned data is valid
        # @return true|array
        isValid: ->
            throw 'don\'t use the Spreadsheet class itself, use subclasses'

        # Loads the document and checks its validity. The callbackfunction
        # should be of the type
        #   function (err, data) {}
        # err  will be a non-null array if an error or warning occured.
        # data will be null only if an error occured, otherwise it will be an
        #      array containing the tuples in the spreadsheet
        load: (callback) ->
            @loadRaw (err, data) =>
                if data?
                    dataErr = @isValid data
                    if dataErr isnt true
                        if not err?
                            err = dataErr
                        else
                            dataErr.push err
                            err = dataErr

                if err? and Object.isString err
                    err = [ err ]

                callback err, data

    # exported function

    exports.parseKey = parseKey
    exports.keyToUrl = keyToUrl

    # exported classes

    class Manifest extends Spreadsheet
        isValid: (data) ->
            err = []
            i = 1 # start at 1 for non-computer science people

            data.forEach (elem) ->
                checkKeyExists elem, 'tag',         err, i
                checkKeyExists elem, 'faction',     err, i
                checkKeyExists elem, 'key',         err, i
                checkKeyExists elem, 'lastupdated', err, i
                checkKeyExists elem, 'refresh',     err, i

                i++

            if err.length is 0
                true
            else
                err

    class Source extends Spreadsheet
        isValid: (data) ->
            err = []
            i = 1 # start at 1 for non-computer science people

            data.forEach (elem) ->
                checkKeyExists elem, 'oid',      err, i

                # frankly, we don't care
                # checkKeyExists elem, 'name',     err, i
                # checkKeyExists elem, 'nickname', err, i
                # checkKeyExists elem, 'level',    err, i

                i++

            if err.length is 0
                true
            else
                err

    exports.Manifest = Manifest
    exports.Source = Source
)(iidentity or (iidentity = window.iidentity = {}))
