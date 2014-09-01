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
            if '' isnt (val = $('#search_faction').selected())
                pattern.faction = val

            if 0 isnt (val = $('#search_anomalies').selected()).length
                pattern.extra =
                    anomaly: val

        $modal = $ '.modal'
            .modal 'show'
            .delay 1000

        comm.find pattern, (results) ->
            $modal
                .promise()
                .done ->
                    $modal.modal 'hide'

            module.log.log 'Results for', pattern, 'are', results

            $results = $ 'div.results'
            $results.empty()

            results.each (result) ->
                $result = $ '<div class="panel panel-' + result.faction + '">'

                if not result.level?
                    level = '0'
                else if typeof result.level is 'number'
                    level = '' + Number.range(0, 16).clamp result.level
                else if typeof result.level is 'string' and result.level.match /^(1[0-6]|[0-9])$/
                    level = result.level
                else
                    level = '0'

                $anomalies = $ '<div class="anomalies col-xs-2">'
                if Object.has result, 'extra'
                    if Object.has result.extra, 'anomaly'
                        anomalies = result.extra.anomaly
                        anomalies = [ anomalies ] unless Array.isArray anomalies

                        $anomalies.append(
                            anomalies.map (anomaly) ->
                                $ '<img>'
                                    .attr 'src', 'img/anomalies/' + anomaly + '.png'
                        )

                $result.append(
                    $ '<div class="panel-heading"><div class="panel-title row">'
                        .append(
                            $ '<div class="col-xs-1 google-plus">'
                                .append(
                                    $ '<a target="_blank">'
                                        .attr 'href', 'https://plus.google.com/' + result.oid
                                        .append $ '<img src="img/g+.png" />'
                                )
                        )
                        .append(
                            $ '<div class="col-xs-3">'
                                .text result.name
                        )
                        .append(
                            $ '<div class="col-xs-3">'
                                .text result.nickname or '?'
                        )
                        .append(
                            $ '<div class="col-xs-1">'
                                .addClass 'iidentity-level-' + level
                                .text module._('levelValue', 'L{value}').assign { value: if level is '0' then '?' else level }
                        )
                        .append $anomalies
                )

                # append sources
                sources = if Array.isArray result.source then result.source else [ result.source ]

                $result.append(
                    $ '<ul class="list-group">'
                        .append sources.map (source) ->
                            $ '<li class="list-group-item">'
                                .append(
                                    $ '<a target="_blank">'
                                        .attr 'href', source.url
                                        .text source.tag
                                )
                )

                $results.append $result


    $ ->
        module.extension.init?()

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
