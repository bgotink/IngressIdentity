# translation function
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->

    exports = module.i18n = {}

    # we can cache this, as a change in the language is only effective
    # after reloading the page
    messages = null

    locale = $ 'html'
        .attr 'lang'

    exports.init = (callback) ->
        module.comm.getTranslationsWithPrefix locale, 'content', (msg) ->
            messages = msg
            callback()

    exports.getMessage = (name, placeholders) ->
        if not Object.has messages, name
            if placeholders?
                return name.assign placeholders
            else
                return name

        message = messages[name]

        if placeholders?
            message.assign placeholders
        else
            message

)(iidentity or (iidentity = window.iidentity = {}))
