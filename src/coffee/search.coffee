# The main script for the search page
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module, $) ->
    comm =
        find: (pattern, callback) ->
            module.comm.send { type: 'find', pattern: pattern }, (result) ->
                callback result.data

    # jQuery helper to get the selected values in a (multi)select
    if not $.fn.selected?
        $.fn.selected = ->
            $this = $ @

            result = $this
                .find 'option:selected'
                .map ->
                    $ @
                        .val()
                .toArray()

            if not $this.is '[multiple]'
                if result.length is 0
                    ''
                else
                    result[0]
            else
                result

    search = ->
        pattern = {}

        if 0 isnt (val = $('#search_name').val().trim()).length
            pattern.name = val
        if 0 isnt (val = $('#search_nickname').val().trim()).length
            pattern.nickname = val

        if $('#search_enable_extra').is ':checked'
            if 'unknown' isnt (val = $('#search_faction').selected())
                pattern.faction = val

            if 0 isnt (val = $('#search_anomalies').selected()).length
                pattern.extra =
                    anomalies: if val.length is 1 then val[0] else val

        comm.find pattern, (results) ->
            module.log.log 'Results for', pattern, 'are', results

            $results = $ 'div.results'
            $results.empty()

            results.each (result) ->
                $result = $ '<div class="panel panel-' + result.faction + '">'
                    .append(
                        $ '<div class="panel-heading"><div class="panel-title">' + result.name + ' &mdash; ' + (result.nickname or '?') + '</div></div>'
                    )

                $container = $result.find '.panel-heading'

                if Object.has result, 'level'
                    if typeof result.level is 'number'
                        level = '' + Number.range(0, 16).clamp result.level
                    else if typeof result.level is 'string' and result.level.match /^(1[0-6]|[0-9])$/
                        level = result.level
                    else
                        level = '0'

                    $container.append(
                        $ '<span class="level">'
                            .addClass 'iidentity-level' + level
                            .text 'Level ' + (if level is '0' then '?' else level)
                    )

                if Object.has result, 'extra'
                    if Object.has result.extra, 'anomaly'
                        anomalies = result.extra.anomaly
                        anomalies = [ anomalies ] unless Array.isArray anomalies

                        $container.append(
                            $ '<span class="anomalies">'
                                .append(
                                    anomalies.map (anomaly) ->
                                        $ '<img>'
                                            .attr 'src', 'img/anomalies/' + anomaly + '.png'
                                )
                        )

                # append other stuff

                $results.append $result


    $ ->
        # make enter submit a form
        $ 'input[type="text"]'
            .on 'keypress', (e) ->
                if e.which is 13
                    $ @
                        .closest 'form'
                        .submit()

                    false

        $ '#search_enable_extra'
            .on 'change', ->
                val = $ @
                    .is ':checked'

                $ '#search_faction, #search_anomalies'
                    .attr 'disabled', !val

        $ 'button.search'
            .on 'click', search
        $ 'form.search'
            .on 'submit', ->
                search()

                false

)(iidentity or (iidentity = window.iidentity = {}), window.jQuery)
