/**
 * The main script for the search page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import _ from 'lodash';
import { Player } from 'ingress-identity';

import { send, Request } from './communication';
import translate from './auto-translate';
import * as log from './log';

function find(pattern: Pattern, callback: (result: Object) => void) {
  send({ type: 'find', pattern }, ({ data }) => callback(data));
}

// helper to get the selected values in a (multi)select
function getSelected($element: JQuery): string|string[] {
  const result: string[] = $element.find('option:selected')
    .map(function (): string { return $(this).val(); })
    .toArray();

  if (this.is('[multiple]')) {
    return result;
  }

  return result.length ? result[0] : '';
}

interface Pattern {
  name?: string;
  nickname?: string;
  faction?: string|string[];
  extra?: {
    anomaly: string|string[];
  };
}

function search() {
  const pattern: Pattern = {};
  let val: string;

  if ((val = $('#search_name').val().trim()).length) {
    pattern.name = val;
  }
  if ((val = $('#search_nickname').val().trim()).length) {
    pattern.nickname = val;
  }

  let val2: string|string[];
  if ((val2 = getSelected($('#search_faction'))) !== '') {
    pattern.faction = val2;
  }

  if ((val2 = getSelected($('#search_anomalies'))).length) {
    pattern.extra = {
      anomaly: val,
    };
  }

  const $modal = $('.modal')
    .modal('show')
    .delay(1000);

  find(pattern, (results: Player[]) => {
    $modal.promise().done(() => $modal.modal('hide'));

    log.log('Results for', pattern, 'are', results);

    const $results = $('div.results');
    $results.empty();

    results.forEach(result => {
      const $result = $(`<div class="panel panel-${result.faction}">`);

      let level = '0';
      if (typeof result.level === 'number') {
        level = `${_.clamp(result.level, 0, 16)}`;
      }

      const $anomalies = $('<div class="anomalies col-xs-2">');
      if (result.extra) {
        if (result.extra.anomaly) {
          let anomalies = result.extra.anomaly;

          $anomalies.append(
            anomalies.map(anomaly => (
              $('<img>')
                .attr('src', `img/anomalies/${anomaly}.png`)
            ))
          );
        }
      }

      $result.append(
        $('<div class="panel-heading">')
          .append(
            $('<div class="row">')
              .append(
                $('<div class="col-xs-1 google-plus">')
                  .append(
                    $('<a target="_blank">')
                      .attr('href', `https://plus.google.com/${result.oid}`)
                      .append($('<img src="img/g+.png" />'))
                  )
              )
              .append(
                $('<div class="col-xs-3">').text(result.name)
              )
              .append(
                $('<div class="col-xs-3">').text(result.nickname || '?')
              )
              .append(
                $('<div class="col-xs-1">')
                  .addClass(`iidentity-level-${level}`)
                  .text(translate('levelValue', { value: (level === '0') ? '?' : level }))
              )
              .append($anomalies)
          )
      );

      // append sources

      $result.append(
        $('<ul class="list-group">')
          .append(result.sources.map(source => (
            $('<li class="list-group-item">')
              .append(
                $('<a target="_blank">')
                  .attr('href', source.url)
                  .text(source.tag)
              )
          )))
      );

      $results.append($result);
    });
  });
}

$($ => {
  // make enter submit a form
  $('input[type="text"]').on('keypress', function (e) {
    if (e.which !== 13) {
      return undefined;
    }
    $(this).closest('form').submit();

    return false;
  });

  // make the reset button for anomalies work
  $('button.reset-anomalies').on('click', _ => {
    $('#search_anomalies > option').prop('selected', false);
  });

  // make the search form work
  $('button.search').on('click', search);
  $('form.search').on('submit', _ => {
    search();
    return false;
  });
});
