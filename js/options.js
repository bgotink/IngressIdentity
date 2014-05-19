/**
 * The main script for the options page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module, $) {
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
            addManifest: function (key, name, callback) {
                module.comm.send({ type: 'addManifest', key: key, name: (Object.isString(name) ? name : '') }, function (result) {
                    callback(result.status);
                });
            },
            renameManifest: function (key, oldName, newName, callback) {
                module.comm.send({type: 'renameManifest', key: key, oldName: oldName, newName: newName}, function (result) {
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

                errors.each(function (err) {
                    if (err.match(/Sign in/i) && err.substr(0, 2) == '<a' && err.substr(-4) === '</a>') {
                        $elem.append($('<p class="error">').append($(err)));
                    } else {
                        $elem.append(
                            $('<p class="error">')
                                .text(err)
                        );
                    }
                });
            } else {
                Object.each(errors, function (key, value) {
                    reloadManifestErrorsHelper(
                        value,
                        $elem.find('[data-key="' + key + '"]')
                    );
                });
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
                var manifestList = [],
                    sourceList;

                module.log.log('Got manifest info: ', result);

                if (Object.isEmpty(result)) {
                    $('#source_list').html('')
                        .append(
                            $('<p>')
                                .text('No manifests loaded right now, try adding some!')
                        )
                        .append(
                            $('<p>')
                                .text('If you have just reloaded the extension, the manifests '
                                    + 'will automatically be shown here when the data is ready.')
                        )
                        .append(
                            $('<p>')
                                .text('If you believe this is in error, try reloading '
                                    + 'this page or pressing "Force reload".')
                        );

                    return;
                }

                Object.each(result, function (key, value) {
                    sourceList = [];

                    module.log.log('Manifest key %s', key);
                    module.log.log(value);

                    value.sources.each(function (source) {
                        module.log.log('-- Source key %s', source.key);

                        sourceList.push(
                            $('<li>')
                                .addClass('source faction-' + source.faction)
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
                                                $('<span class="key-container"></span>')
                                                    .append(
                                                        value.url
                                                            ? $('<a>')
                                                                .text((Object.isString(value.name) && !value.name.isBlank()) ? value.name : key)
                                                                .attr('target', '_blank')
                                                                .attr('href', value.url)
                                                                .addClass('manifest-key')
                                                            : $('<span>')
                                                                .text((Object.isString(value.name) && !value.name.isBlank()) ? value.name : key)
                                                                .addClass('manifest-key')
                                                    )
                                            )
                                            .append(
                                                $('<span>')
                                                    .addClass('buttons')
                                                    .append(
                                                        $('<button>')
                                                            .attr('type', 'button')
                                                            .attr('aria-hidden', 'true')
                                                            .attr('title', 'Rename')
                                                            .addClass('rename')
                                                            .append(
                                                                $('<span class="glyphicon glyphicon-pencil"></span>')
                                                            )
                                                    )
                                                    .append(
                                                        $('<button>')
                                                            .attr('type', 'button')
                                                            .attr('aria-hidden', 'true')
                                                            .attr('title', 'Remove')
                                                            .addClass('remove')
                                                            .append(
                                                                $('<span class="glyphicon glyphicon-remove"></span>')
                                                            )
                                                    )
                                            )
                                    )
                                    .append(
                                        $('<div class="panel-body"></div>')
                                            .append(
                                                $('<ul>')
                                                    .addClass('errors list-unstyled')
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
                });

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
            $('#name_input').attr('disabled', true);
            $('button.manifest_add').button('loading');

            comm.addManifest($('#manifest_input').val(), $('#name_input').val(), function (result) {
                if (result !== 'failed') {
                    $('#manifest_input').val('');
                    $('#name_input').val('');
                }

                $('#manifest_input').attr('disabled', null);
                $('#name_input').attr('disabled', null);
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
        $('form.manifest_add').on('submit.ii.add', function () {
            addManifest();

            return false;
        });

        // make enter submit a form
        $('input[type="text"]').on('keypress', function (e) {
            if (e.which === 13) {
                $(this).closest('form').submit();

                return false;
            }
        })

        $('#source_list').on('click.ii.remove', '.manifest .remove', function () {
            comm.removeManifest(
                $(this).closest('.manifest').data('key'),
                function (result) {
                    showAlert('remove-' + result);
                }
            );
        });
        $('#source_list').on('click.ii.rename', '.manifest .rename', function () {
            var $this = $(this),
                $manifest = $this.closest('.manifest'),
                $key = $manifest.find('.manifest-key');

            if ($key.hasClass('form-control')) {
                // already done...
                return;
            }

            module.log.log('Creating input to rename manifest %s', $key.text());

            $key.replaceWith(
                $('<input type="text" class="form-control manifest-key"></input>')
                    .val(($key.text() === $manifest.data('key')) ? '' : $key.text())
                    .data('old-name', $key.text())
                    .data('url', $key.prop('tagName') === 'A' ? $key.attr('href') : null)
            );
        });
        $('#source_list').on('keypress', 'input.manifest-key', function (e) {
            if (e.which !== 13) {
                return;
            }

            var $this = $(this),
                $manifest = $this.closest('.manifest'),
                key = $manifest.data('key'),
                oldName = $this.data('old-name'),
                newName = $this.val(),
                $replacement;

            if (oldName.compact() !== newName.compact()) {
                if (newName.isBlank()) {
                    newName = null;
                }

                if (oldName.compact() === key.compact()) {
                    oldName = null;
                }

                module.log.log(
                    'Renaming manifest %s from %s to %s',
                    key,
                    oldName,
                    newName !== null ? newName : ''
                );

                comm.renameManifest(
                    key,
                    oldName,
                    newName,
                    function (status) {
                        showAlert('rename-' + status);
                    }
                );
            }

            if (Object.isString($this.data('url'))) {
                $replacement = $('<a target="_blank">')
                    .attr('href', $this.data('url'));
            } else {
                $replacement = $('<p>');
            }

            $replacement.text($this.val().isBlank() ? key : $this.val())
                .addClass('manifest-key');

            $this.replaceWith($replacement);

            return false;
        });

        reloadManifests();

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
})(window.iidentity, window.jQuery);
