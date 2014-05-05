/**
 * The main script for the options page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module, window) {
    'use strict';

    var comm = {
            getManifests: function (callback) {
                module.comm.send({ type: 'getManifests' }, function (result) {
                    callback(result);
                });
            },
            getManifestErrors: function (callback) {
                module.comm.send({ type: 'getManifestErrors' }, function (result) {
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

            changeManifestOrder: function (oldOrder, newOrder, callback) {
                module.comm.send(
                    { type: 'changeManifestOrder', oldOrder: oldOrder, newOrder: newOrder },
                    function (result) {
                        callback(result.status);
                    }
                );
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
            },

            setOption: function (option, value, callback) {
                module.comm.send({ type: 'setOption', option: option, value: value }, function (result) {
                    callback(result.result);
                });
            },
            getOption: function (option, defaultValue, callback) {
                module.comm.send({ type: 'getOption', option: option, defaultValue: defaultValue }, function (result) {
                    callback(result.value);
                });
            }
        },

        showAlert = function (id) {
            module.log.log('showing alert %s', id);
            $('.alert').addClass('hide');
            $('.alert-' + id).removeClass('hide');
        },

        lastOrderRecorded = [],
        onOrderChanged = function () {
            var newOrder = $.makeArray(
                    $('#source_list > ul > li').map(function () {
                        return $(this).attr('data-key');
                    })
                ),
                i,
                length = lastOrderRecorded.length,
                updated = false;

            if (newOrder.length !== length) {
                // abort, strange things are happening
                return;
            }

            for (i = 0; i < length; i++) {
                if (newOrder[i] !== lastOrderRecorded[i]) {
                    updated = true;
                    break;
                }
            }

            if (updated) {
                comm.changeManifestOrder(lastOrderRecorded, newOrder, function (status) {
                    showAlert('reorder-' + status);
                });

                lastOrderRecorded = newOrder;
            }
        },

        reloadManifestErrorsHelper = function (errors, $elem) {
            if (Array.isArray(errors)) {
                $elem.find('> p.error').remove();

                errors.forEach(function (err) {
                    if (err.match(/Sign in/i) && err.substr(0, 2) == '<a' && err.substr(-4) === '</a>') {
                        $elem.append($(err));
                    } else {
                        $elem.append(
                            $('<p>')
                                .addClass('error')
                                .text(err)
                        );
                    }
                });
            } else {
                var key;

                for (key in errors) {
                    reloadManifestErrorsHelper(
                        errors[key],
                        $elem.find('[data-key="' + key + '"]')
                    );
                }
            }
        },
        reloadManifestErrors = function () {
            if ($('#source_list > ul').data('errors-loaded')) {
                return;
            }
            $('#source_list > ul').data('errors-loaded', true);

            module.log.log('Reloading manifest errors...');
            comm.getManifestErrors(function (result) {
                module.log.log('Got manifest errors: ', result);

                reloadManifestErrorsHelper(result, $('#source_list > ul'));
            });
        },

        reloadManifests = function () {
            module.log.log('Reloading manifests...');
            comm.getManifests(function (result) {
                var key,
                    manifestList = [],
                    sourceList;

                module.log.log('Got manifest info: ', result);

                for (key in result) {
                    sourceList = [];

                    module.log.log('Manifest key %s', key);
                    module.log.log(result[key]);

                    result[key].sources.forEach(function (source) {
                        module.log.log('-- Source key %s', source.key);

                        sourceList.push(
                            $('<li>')
                                .addClass('source')
                                .addClass('faction-' + source.faction)
                                .attr('data-key', source.key)
                                .append(
                                    source.url
                                        ? $('<a>')
                                            .text(source.tag)
                                            .attr('target', '_blank')
                                            .attr('href', source.url)
                                        : $('<span>')
                                            .text(source.tag)
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
                            .attr('data-key', key)
                            .append(
                                $('<div class="panel panel-default"></div>')
                                    .append(
                                        $('<div class="panel-heading"></div>')
                                            .append(
                                                result[key].url
                                                    ? $('<a>')
                                                        .text(key)
                                                        .attr('target', '_blank')
                                                        .attr('href', result[key].url)
                                                        .addClass('manifest-key')
                                                    : $('<span>')
                                                        .text(key)
                                                        .addClass('manifest-key')
                                            )
                                            .append(
                                                $('<a>')
                                                    .html('&times;')
                                                    .attr('href', '#')
                                                    .addClass('remove')
                                                    .addClass('pull-right')
                                            )
                                    )
                                    .append(
                                        $('<div class="panel-body"></div>')
                                            .append(
                                                $('<ul>')
                                                    .addClass('errors')
                                                    .addClass('list-unstyled')
                                                    .attr('data-key', '__errors')
                                            )
                                            .append(
                                                $('<ul>')
                                                    .addClass('list-unstyled')
                                                    .append(sourceList)
                                            )
                                    )
                            )
                    );
                }

                $('#source_list').html('')
                    .append(
                        $('<ul>')
                            .addClass('list-unstyled')
                            .append(manifestList)
                    );
                $('#reload_sources').button('reset');


                lastOrderRecorded = $.makeArray(
                    $('#source_list > ul > li').map(function () {
                        return $(this).attr('data-key');
                    })
                );
                $('#source_list > ul').sortable({
                    axis: 'y',
                    containment: 'parent',
                    cursor: '-webkit-grabbing',
                    distance: 5,
                    revert: true,
                    stop: onOrderChanged
                });
                $('#source_list > ul').disableSelection();

                reloadManifestErrors();
            });
        },

        updateButtons = function () {
            module.comm.hasPermission('tabs', function (hasPermission) {
                if (hasPermission) {
                    $('#enable_push').addClass('active');
                }
            });

            comm.getOption('show-anomalies', true, function (state) {
                if (state) {
                    $('#enable_anomalies').addClass('active');
                } else {
                    $('#enable_anomalies').removeClass('active');
                }
            });

            $('button[data-match]').each(function () {
                var $this = $(this);

                comm.getOption('match-' + $this.attr('data-match'), true, function (state) {
                    if (state) {
                        $this.addClass('active');
                    } else {
                        $this.removeClass('active');
                    }
                });
            });
        },

        addManifest = function () {
            module.log.log('Adding manifest %s', $('#manifest_input').val());

            $('#manifest_input').attr('disabled', true);
            $('button.manifest_add').button('loading');

            comm.addManifest($('#manifest_input').val(), function (result) {
                if (result !== 'failed') {
                    $('#manifest_input').val('');
                }

                $('#manifest_input').attr('disabled', null);
                $('button.manifest_add').button('reset');

                showAlert('add-' + result);
            });
        };

    $(function () {
        $('.alert .close').on('click.ii.close', function () {
            $(this).parent().addClass('hide');
        });

        $('#reload_sources').on('click.ii.reload', function () {
            var $this = $(this);

            $this.button('loading');

            comm.reloadData(function (result) {
                showAlert('reload-' + result);
                $this.button('reset');
            });
        });

        $('button.manifest_add').on('click.ii.add', addManifest);
        $('form.manifest_add').on('submit.ii.add', function (e) {
            addManifest();
            e.preventDefault();
        });

        $('#source_list').on('click.ii.remove', '.manifest > .remove', function () {
            comm.removeManifest(
                $(this).parent().data('key'),
                function (result) {
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
            $this.button('loading');

            if ($this.hasClass('active')) {
                comm.revokePermission('tabs', function (revoked) {
                    if (revoked) {
                        $this.removeClass('active');
                    }

                    $this.data('iidentity-working', false);
                    $this.button('reset');
                });
            } else {
                comm.requestPermission('tabs', function (granted) {
                    if (granted) {
                        $this.addClass('active');
                    }

                    $this.data('iidentity-working', false);
                    $this.button('reset');
                })
            }
        });

        $('#enable_anomalies').on('click.set-option', function () {
            var $this = $(this);
            $this.button('loading');

            comm.setOption('show-anomalies', !$this.hasClass('active'), function (state) {
                if (state) {
                    $this.addClass('active');
                } else {
                    $this.removeClass('active');
                }
                $this.button('reset');
            });
        });

        $('button[data-match]').on('click.set-option', function () {
            var $this = $(this);
            $this.button('loading');

            comm.setOption('match-' + $this.attr('data-match'), !$this.hasClass('active'), function (state) {
                if (state) {
                    $this.addClass('active');
                } else {
                    $this.removeClass('active');
                }
                $this.button('reset');
            });
        });

        updateButtons();

        module.comm.setOnUpdate(function () {
            reloadManifests();
            updateButtons();
        });
    });
})(window.iidentity, window);
