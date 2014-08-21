$ ->
    $ 'body'
        .scrollspy
            target: '.help-nav'

    $ '#manifest_url'
        .on 'keyup', ->
            url = $ '#manifest_url'
                .val()

            $result = $ '#manifest_key'

            # oldSheet: 'https://docs.google.com/spreadsheet/ccc?key={key}'
            # newSheet: 'https://docs.google.com/spreadsheets/d/{key}'

            return unless url?
            if not url.startsWith 'https://docs.google.com/spreadsheet'
                if 'https://docs.google.com/spreadsheet'.startsWith url
                    $result.val ''
                else
                    $result.val 'Invalid URL'
                return

            url = url.from 35 # 'https://docs.google.com/spreadsheet'.length

            gid = url.match /[#?&]gid=(.*)([#&]|$)/
            if gid?
                gid = gid[1]
                if 0 isnt +gid
                    gid = '&gid=' + gid
                else
                    gid = ''
            else
                gid = ''

            if url.startsWith '/ccc?'
                # ye olde URL style
                matches = url.match /\?(.*&)?key=([^&#]*)([#&]|$)/

                if matches?
                    $result.val matches[2] + gid
                else
                    $result.val 'Invalid URL'
            else if url.startsWith 's/d/'
                # new URL style
                url = url.from 4 # 's/d/'.length

                $result.val url.remove(/[#?/].*$/) + gid

    $ '#oid_url'
        .on 'keyup', ->
            url = $ '#oid_url'
                .val()

            $result = $ '#oid_oid'

            if not url.startsWith 'https://plus.google.com/'
                if 'https://plus.google.com'.startsWith url
                    $result.val ''
                else
                    $result.val 'Invalid URL'

                return

            url = url.from 24 # 'https://plus.google.com/'.length

            if url.startsWith 'u/0/'
                url = url.from 4 # 'u/0/'.length

            type = url.to url.indexOf '/'

            if type is 'events' or type is 'communities'
                url = url.from type.length + 1

                $result.val url.remove /[#?/].*$/
            else
                url = url.remove /[#?/].*$/

                if url.match /[0-9]{21}/
                    $result.val url
                else
                    $result.val 'Invalid URL'
