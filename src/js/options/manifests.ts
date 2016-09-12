/*
 * Shows the manifests and allows manipulation.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { ManifestMetaData } from 'ingress-identity';

import _ from 'lodash';

import * as comm from './communication';
import showAlert from './alerts';
import * as log from '../log';
import translate from '../auto-translate';

let lastOrderRecorded: string[] = [];

function onOrderChanged() {
  const newOrder: string[] = $.makeArray(
    $('#source_list > ul > li').map(function (): string {
      return $(this).attr('data-key');
    })
  );
  const { length } = lastOrderRecorded;
  let updated = false;

  if (newOrder.length !== length) {
    // abort, strange things are happening
    return;
  }

  for (let i = 0; i < length; i++) {
    if (newOrder[i] !== lastOrderRecorded[i]) {
      updated = true;
      break;
    }
  }

  if (updated) {
    comm.changeManifestOrder(lastOrderRecorded, newOrder, status => {
      showAlert(`reorder-${status}`);
    });

    lastOrderRecorded = newOrder;
  }
}

function reloadManifestErrors() {
  if ($('#source_list > ul').data('errors-loaded')) {
    return;
  }
  $('#source_list > ul').data('errors-loaded', true);

  log.log('Reloading manifest errors...');
  comm.getManifestErrors(result => {
    log.log('Got manifest errors:', result);

    reloadManifestErrorsHelper(result, $('#source_list > ul'))
  });
}

type Errors = string[] | { [s: string]: Errors };

function reloadManifestErrorsHelper(errors: Errors, $elem: JQuery) {
  if (Array.isArray(errors)) {
    $elem.find('> p.error').remove();

    errors.forEach(err => {
      if (err.match(/Sign in/i) && err.substr(0, 2) === '<a' && err.substr(-4) === '</a>') {
        $elem.append($('<p class="error">').append($(err)));
      } else {
        $elem.append($('<p class="error">').text(err));
      }
    });
  } else {
    _.forEach(errors, (value: Errors, key: string) => {
      if (key === '__errors' && $elem.find('> .panel > .panel-body').length === 0) {
        $('<div class="panel-body" data-key="__errors">').insertBefore($elem.find('> .panel > .list-group'));
      }

      reloadManifestErrorsHelper(value, $elem.find(`[data-key="${key}"]`));
    });
  }
}

export function reloadManifests() {
  log.log('Reloading manifests...');
  comm.getManifests((result) => {
    const manifestList: JQuery[] = [];

    log.log('Got manifest info:', result);

    if (_.isEmpty(result)) {
      $('#source_list')
        .html('')
        .append(
          $('<p>')
            .text(translate('empty_1' /* 'No manifests loaded right now, try adding some!' */))
        )
        .append(
          $('<p>')
            .text(translate('empty_2' /* 'If you have just reloaded the extension, the manifests will automatically be shown here when the data is ready.' */))
        )
        .append(
          $('<p>')
            .text(translate('empty_3' /* 'If you believe this is in error, try reloading this page or pressing "Force reload".' */))
        );

      return;
    }

    _.forEach(result, (value) => {
      const sourceList: JQuery[] = [];
      const { key } = value;

      log.log('Manifest key %s', key);
      log.log(value);

      _.forEach(value.sources, (source, key) => {
        log.log('-- Source key %s', key);

        // Clean up info to show, in case the manifest is faulty
        source.faction = source.faction || 'unknown';
        source.count = source.count || 0;
        source.tag = source.tag || source.key;
        source.version = source.version || '0';

        sourceList.push(
          $('<li>')
            .addClass(`list-group-item source faction-${source.faction}`)
            .attr('data-key', key)
            .append(source.url
              ? $('<a>').text(source.tag).attr('target', '_blank').attr('href', source.url)
              : $('<span>').text(source.tag)
            )
            .append($('<p>').text(translate('manifest_info', source /* 'Faction: {faction}, {count} players, version {version}' */)))
        );
      });

      manifestList.push(
        $('<li>')
          .addClass('manifest')
          .data('key', key)
          .attr('data-key', key)
          .append(
            $('<div class="panel panel-default">')
              .append(
                $('<div class="panel-heading">')
                  .append(
                    $('<span class="key-container">')
                      .append(
                        $('<span>')
                          .text(typeof value.name === 'string' && value.name.trim().length ? value.name : key)
                          .addClass('manifest-key')
                      )
                  )
                  .append(
                    $('<span>')
                      .addClass('buttons')
                      .append(value.url
                        ? $('<a>')
                            .attr('aria-hidden', 'true')
                            .attr('title', translate('view' /* 'View' */))
                            .attr('href', value.url)
                            .attr('target', '_blank')
                            .addClass('link')
                            .append($('<span class="glyphicon glyphicon-link"></span>'))
                        : null
                      )
                      .append(
                        $('<button>')
                          .attr('type', 'button')
                          .attr('aria-hidden', 'true')
                          .attr('title', translate('rename' /* 'Rename' */))
                          .addClass('rename')
                          .append($('<span class="glyphicon glyphicon-pencil"></span>'))
                      )
                      .append(
                        $('<button>')
                          .attr('type', 'button')
                          .attr('aria-hidden', 'true')
                          .attr('title', translate('remove' /* 'Remove' */))
                          .addClass('remove')
                          .append($('<span class="glyphicon glyphicon-remove"></span>'))
                      )
                  )
              )
              .append(
                $('<ul>')
                  .addClass('list-group')
                  .append(sourceList)
              )
          )
      );
    });

    $('#source_list')
      .html('')
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

    $('#source_list > ul')
        .sortable({
            axis: 'y',
            containment: 'parent',
            handle: '.panel-heading',
            cursor: '-webkit-grabbing',
            distance: 5,
            revert: true,
            stop: onOrderChanged,
        });
    $('#source_list .panel-heading')
        .disableSelection();

    reloadManifestErrors();
  });
}

function addManifest() {
  const newManifest = $('#manifest_input').val().trim();
  if (newManifest === '') {
    return;
  }

  log.log('Adding manifest %s', newManifest);

  $('#manifest_input, #name_input').prop('disabled', true);
  $('button.manifest_add').button('loading');

  comm.addManifest(newManifest, $('#name_input').val(), result => {
    if (result !== 'failed') {
      $('#manifest_input').val('');
      $('#name_input').val('');
    }

    $('#manifest_input, #name_input').prop('disabled', false);
    $('button.manifest_add').button('reset');

    showAlert(`add-${result}`);
  });
}

export function initManifests() {
  $('button.manifest_add').on('click.ii.add', addManifest);
  $('form.manifest_add').on('submit.ii.add', _ => {
    addManifest();
    return false;
  });

  $('#source_list').on('click.ii.remove', '.manifest .remove', function () {
    comm.removeManifest($(this).closest('.manifest').data('key'), result => {
      showAlert(`remove-${result}`);
    });
  });

  $('#source_list').on('click.ii.rename', '.manifest .rename', function () {
    const $this = $(this);
    const $manifest = $this.closest('.manifest');
    const $key = $manifest.find('.manifest-key');

    if ($key.hasClass('form-control')) {
      // already done
      return;
    }

    log.log('Creating input to rename manifest %s', $key.text());
    let oldName = $key.text() === $manifest.data('key') ? '' : $key.text();

    $key.replaceWith(
      $('<input type="text" class="form-control manifest-key">')
        .val(oldName)
        .data('url', $key.prop('tagName') === 'A' ? $key.attr('href') : null)
        .on('keypress', function (e) {
          if (e.which !== 13) {
            return undefined;
          }

          const $this = $(this);
          const $manifest = $this.closest('.manifest');
          const key = $manifest.data('key');
          let newName: string = $this.val();

          if (oldName.trim() !== newName.trim()) {
            if (!newName.trim().length) {
              newName = null;
            }

            if (!oldName.trim().length) {
              oldName = null;
            }

            log.log('Renaming manifest %s from %s to %s', key, oldName, newName);
            comm.renameManifest(key, oldName, newName, status => {
              showAlert(`rename-${status}`);
            })
          }

          let $replacement: JQuery;
          if (typeof $this.data('url') === 'string') {
            $replacement = $('<a target="_blank">')
              .attr('href', $this.data('url'));
          } else {
            $replacement = $('<p>');
          }

          $replacement.text(newName || key)
            .addClass('manifest-key');

          $this.replaceWith($replacement);

          return false;
        })
    );
  });

  reloadManifests();
}
