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
                url: module.extension.getUrl '_locales/' + locale + '/messages.json'
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
            @load locale, () ->
                if loadedLocales[locale].data[name]?
                    callback true, loadedLocales[locale].data[name]
                else
                    callback false

        # get the message, fallback to other locale if not found
        getMessageWithFallbacks: (locales, name, callback) ->
            if locales.isEmpty()
                callback false
                return

            getMessage locales.first(), name, (found, message) ->
                if found
                    callback true, message
                    return

                getMessageWithFallbacks locales.slice(1), name, callback

    exports.getMessage = (locale, name, placeholders, callback) ->
        locales = [ locale ]

        if locale.has '_'
            locales.push locale.to locale.indexOf '_'

        locales.push defaultLocale

        getMessageWithFallbacks locales, name, (found, message) ->
            if not found
                callback false, name
                return

            # TODO do the placeholder stuff
            callback true, message

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
