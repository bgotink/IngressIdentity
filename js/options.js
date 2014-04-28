/**
 * The main script for the options page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, $) {
    var comm = {
            getManifests: function (callback) {
                module.comm.send({ type: 'getManifests' }, function (result) {
                    callback(result);
                });
            },
            addManifest: function (key, callback) {
                module.comm.send({ type: 'addManifest', key: key }, function (result) {
                    callback(result.status);
                });
            },
            removeManifest: function (key, callback) {
                module.comm.send({ type: 'removeManifest', key: key }, function (result) {
                    callback(result.status);
                });
            },

            reloadData: function (callback) {
                module.comm.send({ type: 'reloadData' }, function (result) {
                    callback(result.status);
                });
            },

            requestPermission: function (permission, callback) {
                module.comm.send({ type: 'requestPermission', permission: permission }, function (result) {
                    callback(result.granted);
                });
            },
            revokePermission: function (permission, callback) {
                module.comm.send({ type: 'revokePermission', permission: permission }, function (result) {
                    callback(result.revoked);
                })
            }
        },

        showAlert = function (id) {
            console.log('showing alert %s', id);
            $('.alert').addClass('hide');
            $('.alert-' + id).removeClass('hide');
        },

        reloadManifests = function () {
            console.log('Reloading manifests...');
            comm.getManifests(function (result) {
                var key,
                    manifestList = [],
                    sourceList;

                console.log('Got manifest info: ', result);

                for (key in result) {
                    sourceList = [];

                    console.log('Manifest key %s', key);

                    result[key].forEach(function (source) {
                        console.log('-- Source key %s', source.key);

                        sourceList.push(
                            $('<li>')
                                .addClass('source')
                                .addClass('faction-' + source.faction)
                                .append(
                                    $('<a>')
                                        .text(source.tag)
                                        .attr('target', '_blank')
                                        .attr('href', 'https://docs.google.com/spreadsheet/ccc?key=' + source.key)
                                )
                                .append(
                                    $('<p>')
                                        .text('Faction: ' + source.faction + ', ' + source.count + ' players, version ' + source.version)
                                )
                        );
                    });

                    manifestList.push(
                        $('<li>')
                            .addClass('manifest')
                            .data('key', key)
                            .append(
                                $('<a>')
                                    .text(key)
                                    .attr('target', '_blank')
                                    .attr('href', 'https://docs.google.com/spreadsheet/ccc?key=' + key)
                            )
                            .append(
                                $('<a>')
                                    .html('&times;')
                                    .attr('href', '#')
                                    .addClass('remove')
                            )
                            .append(
                                $('<ul>')
                                    .append(sourceList)
                            )
                    );
                }

                $('#source_list').html('')
                    .append(
                        $('<ul>').append(manifestList)
                    );
            });
        };

    $(function () {
        $('.alert .close').on('click.ii.close', function () {
            $(this).parent().addClass('hide');
        });

        $('#reload_sources').on('click.ii.reload', function () {
            comm.reloadData(function (result) {
                if (result) {
                    reloadManifests();
                    showAlert('reload-success');
                } else {
                    showAlert('reload-failed');
                }
            });
        });

        $('#manifest_add').on('click.ii.add', function () {
            console.log('Adding manifest %s', $('#manifest_input').val());
            comm.addManifest($('#manifest_input').val(), function (result) {
                if (result === 'success') {
                    reloadManifests();
                    $('#manifest_input').val('');
                }

                showAlert('add-' + result);
            });
        });

        $('#source_list').on('click.ii.remove', '.manifest > .remove', function () {
            comm.removeManifest(
                $(this).parent().data('key'),
                function (result) {
                    if (result === 'success') {
                        reloadManifests();
                    }

                    showAlert('remove-' + result);
                }
            );
        });

        reloadManifests();

        $('#enable_push').on('click.request-permission', function () {
            var $this = $(this);

            if ($this.data('iidentity-working') == true) {
                // already requesting...
                return;
            }
            $this.data('iidentity-working', true);

            if ($this.hasClass('active')) {
                comm.revokePermission('tabs', function (revoked) {
                    if (revoked) {
                        $this.removeClass('active');
                    }
                    $this.data('iidentity-working', false);
                });
            } else {
                comm.requestPermission('tabs', function (granted) {
                    if (granted) {
                        $this.addClass('active');
                    }
                    $this.data('iidentity-working', false);
                })
            }
        });

        module.comm.hasPermission('tabs', function (hasPermission) {
            if (hasPermission) {
                $('#enable_push').addClass('active');
            }
        });
    });
})(window.iidentity, window.jQuery);
