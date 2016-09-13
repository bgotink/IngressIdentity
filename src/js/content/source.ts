/*
 * function to list the source files connected to a community or event
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { SourceMetaData } from 'ingress-identity';

import doOnce from './doOnce';
import * as comm from '../communication';
import * as log from '../log';
import translate from './i18n';

function checkEvent() {
  const $elem = $('[token]');

  let str: string;
  if ($elem.length) {
    str = $elem.first().attr('token');
  } else {
    str = document.location.pathname;
  }

  const match = str.match(/(^|\/)events\/([a-zA-Z0-9]+)$/);
  if (!match) {
    return;
  }

  const oid = match[2];

  doOnce($('div.Ee.fP.Ue.eZ'), $parent => {
    comm.getSourcesForExtra('event', oid, (sources: SourceMetaData[]) => {
      log.log('Sources for this event (oid=%s):', oid);
      log.log(sources);

      $parent.find('.iidentity-event').remove();

      if (!sources || !Array.isArray(sources) || !sources.length) {
        return;
      }

      $parent.find('div.pD')
        .after(
          $('<div class="pD iidentity-event">')
            .append(
              $('<b>').text(translate('sourceFiles'))
            )
            .append(
              $(sources.map(source => (
                $('<div>')
                  .append(
                    $('<a>')
                      .addClass('Ub')
                      .attr('href', source.url)
                      .attr('target', '_blank')
                      .text(source.key)
                  )
                  [0]
              )))
            )
        );
    });
  });
}

function checkCommunity() {
  const match = document.location.pathname.match(/(^|\/)communities\/([a-zA-Z0-9]+)($|\/)/);
  if (!match) {
    return;
  }

  const oid = match[2];

  doOnce($('div.MZd.uTc'), $parent => {
    comm.getSourcesForExtra('community', oid, (sources: SourceMetaData[]) => {
      log.log('Sources for this community (oid=%s):', oid);
      log.log(sources);

      $parent.find('.iidentity-community').remove();

      if (!sources || !Array.isArray(sources) || !sources.length) {
        return;
      }

      $parent.find('div.LEd').before(
        $('<div class="g0d iidentity-community">')
          .append(
            $('<b>').text(translate('sourceFiles'))
          )
          .append(
            $(sources.map(source => (
              $('<div>')
                .append(
                  $('<a>')
                    .addClass('Ub')
                    .attr('href', source.url)
                    .attr('target', '_blank')
                    .text(source.key)
                )
                [0]
            )))
          )
      );
    });
  });
}

export default function listSources() {
  checkEvent();
  checkCommunity();
}
