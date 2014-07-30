# translation function
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->

    # we can cache this, as a change in the language is only effective
    # after reloading the page
    translationCache = {}

    locale = $ 'html'
        .attr('lang')

    module.translate = (name, placeholders, callback) ->
        if not callback?
            callback = placeholders
            placeholders = null

        cacheKey = name
        if placeholders? and not Object.isEmpty placeholders
            cacheKey += JSON.stringify placeholders

        if Object.has translationCache, cacheKey
            callback translationCache[cacheKey]
            return

        module.comm.getTranslation locale, name, placeholders, (found, message) ->
            if not found
                module.log.log 'Unknown translation message: ', name

            translationCache[cacheKey] = message
            callback message

)(iidentity or (iidentity = window.iidentity = {}))
