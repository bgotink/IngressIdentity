# Including this file will automatically translate the page when applicable.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    # abort if auto-translate isn't supported
    return unless module.extension.getI18nMessage?

    # jQuery function to get all attributes of an element
    $.fn.attrs = ->
        return {} if @length is 0

        element = @get 0
        result = {}

        attributes = element.attributes
        attribute = null
        l = attributes.length
        for i in [0..l-1]
            attribute = attributes.item i
            result[attribute.nodeName] = attribute.value

        result

    $ -> #run after DOM loads
        $html = $ 'html'
        if $html.attr 'data-translate-prefix'
            prefix = $html.attr('data-translate-prefix') + '_'
        else
            prefix = ''

        $ '[data-translate-name]'
            .each ->
                $this = $ @

                text = module.extension.getI18nMessage prefix + $this.attr 'data-translate-name'

                if $this.attr('data-translate-placeholders') is 'true'
                    attrs = Object.select $this.attrs(), /^data-translate-placeholder-/
                    placeholders = {}

                    Object.each attrs, (name, value) ->
                        placeholders[name.from 27] = value
                        # 27 = 'data-translate-placeholder-'.length

                    text = text.assign placeholders

                $this.html text
)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
