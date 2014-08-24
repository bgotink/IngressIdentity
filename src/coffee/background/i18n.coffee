# Rewrite Google's i18n because it doesn't allow fetching data
# from a different language than the UI default.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    exports = module.i18n = {}

    loadedLocales = {}
    defaultLocale = 'en'

    localeHelper =
        # returns whether the locale file has finished loading
        isLoaded: (locale) ->
            loadedLocales[locale]?.finished

        # loads the locale, calls callback when done
        load: (locale, callback) ->
            if @isLoaded locale
                callback()
                return

            if loadedLocales[locale]?
                # we're busy loading the locale apparently
                loadedLocales[locale].callbacks.push callback
                return

            loadedLocale = loadedLocales[locale] =
                finished: false
                callbacks: [ callback ]

            setData = (data) ->
                # first set the data
                loadedLocale.data = data

                # then let the world know it's loaded
                loadedLocale.finished = true

                # finally call the callbacks
                loadedLocale.callbacks.each (callback) -> callback()
                delete loadedLocale.callbacks

            $.ajax
                type: 'GET'
                dataType: 'json'
                url: module.extension.getURL '_locales/' + locale + '/messages.json'
                success: (data) -> setData data
                error: (xhr) ->
                    if xhr.status isnt 404
                        # a true error...
                        module.log.error 'Something went wrong while getting locale file: ', xhr.statusText
                        module.log.error xhr

                    # set empty data
                    setData {}

        # simply get the message, calling callback(true, message) or callback(false)
        # depending on whether the message was found
        getMessage: (locale, name, callback) ->
            @load locale, ->
                if loadedLocales[locale].data[name]?
                    callback true, loadedLocales[locale].data[name]
                else
                    callback false

        # get all messages with a given prefix in a given loale
        getPrefixedMessages: (locale, prefix, callback) ->
            @load locale, ->
                data = Object.select loadedLocales[locale].data, new RegExp '^' + prefix + '_'
                offset = prefix.length + 1

                result = {}
                Object.each data, (k, v) ->
                    result[k.from offset] = v.message

                callback result

        # get the message, fallback to other locale if not found
        getMessageWithFallbacks: (locales, name, callback) ->
            if locales.isEmpty()
                callback false
                return

            @getMessage locales.first(), name, (found, message) =>
                if found
                    callback true, message
                    return

                @getMessageWithFallbacks locales.slice(1), name, callback

        # get all prefixed messages, with fallbacks to other locales
        getPrefixedMessagesWithFallbacks: (locales, prefix, callback, state = {}) ->
            if locales.isEmpty()
                callback state
                return

            @getPrefixedMessages locales.first(), prefix, (messages) =>
                newState = Object.merge state, messages, false, false
                @getPrefixedMessagesWithFallbacks locales.slice(1), prefix, callback, newState

    exports.getMessage = (locale, name, placeholders, callback) ->
        locales = [ locale ]

        if locale.contains '_'
            locales.push locale.to locale.indexOf '_'

        locales.push defaultLocale

        localeHelper.getMessageWithFallbacks locales, name, (found, message) ->
            if not found
                callback false, name
                return

            # TODO do the placeholder stuff
            callback true, message

    exports.getPrefixedMessages = (locale, prefix, callback) ->
        locales = [ locale ]

        if locale.contains '_'
            locales.push locale.to locale.indexOf '_'

        locales.push defaultLocale

        localeHelper.getPrefixedMessagesWithFallbacks locales, prefix, callback

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
