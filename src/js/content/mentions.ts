/*
 * Add player info on Google+
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Player, CommunityOrEvent } from 'ingress-identity';
import _ from 'lodash';

import capitalize from 'sugar/string/capitalize';
import humanize from 'sugar-inflections/string/humanize';

import doOnce from './doOnce';
import * as comm from '../communication';
import * as log from '../log';

function doForEach<T, S>(player: Player, key: string, each: (entry: T, i: number) => S|void, done: (result: S[]) => void) {
  const obj = player as { [s: string]: any };
  const results: S[] = [];

  if (_.has(obj, key)) {
    const arr: T[] = Array.isArray(obj[key]) ? obj[key] : [ obj[key] ];

    arr.forEach((elem, i) => {
      const o = each(elem, i);
      if (o) {
        results.push(o);
      }
    });

    if (done) {
      done(results);
    }
  }
}

interface CreateCallback {
  (err?: string, $elem?: JQuery) : void;
};

function createBlockElement(oid: string, match: string, callback: CreateCallback) {
  comm.getPlayer(oid, (err, player) => {
    if (err) {
      return callback(err, null);
    }

    let $name: JQuery, $extraInfo: JQuery, $groupInfo: JQuery;
    const $elem = $('<div>')
      .addClass('iidentity-wrapper')
      .attr('data-oid', oid)
      .append(
        $name = $('<div>')
          .addClass('iidentity-name')
          .addClass(`iidentity-faction-${player.faction}`)
          .text(player.nickname)
      )
      .append(
        $extraInfo = $('<div>').addClass('iidentity-extra')
      )
      .append(
        $groupInfo = $('<div>').addClass('iidentity-group')
      );

    $extraInfo.append(
      $('<span>')
        .addClass(`iidentity-level iidentity-level${player.level}`)
        .text('L' + (player.level === 0 ? '?' : `${player.level}`))
    );

    doForEach(player, 'anomaly', (anomaly: string) => {
      return $('<img>')
        .attr('src', chrome.extension.getURL(`img/anomalies/${anomaly}.png`))
        .attr('alt', capitalize(anomaly.replace(/_/g, ' '), true))
        .attr('title', capitalize(anomaly.replace(/_/g, ' '), true))
        .addClass('iidentity-anomaly');
    }, anomalyList => {
      $name.append(
        $('<div>')
          .addClass('iidentity-anomalies')
          .append(anomalyList)
      );
    });

    doForEach(player, 'community', (community: CommunityOrEvent, i: number) => {
      if (i > 3) {
        return false;
      }
      if (i === 3) {
        return $('<div>').html('&hellip;')[0];
      }

      return $('<div>')
        .append(
          $('<a>')
              .attr('href', `https://plus.google.com/communities/${community.oid.trim()}`)
              .text(community.name.trim())
        )[0];
    }, communityList => {
      $groupInfo.append(communityList);
    });

    doForEach(player, 'event', (event: CommunityOrEvent, i: number) => {
      if (i > 3) {
        return false;
      }
      if (i === 3) {
        return $('<div>').html('&hellip;')[0];
      }

      return $('<div>')
        .append(
          $('<a>')
              .attr('href', `https://plus.google.com/events/${event.oid.trim()}`)
              .text(event.name.trim())
        )[0];
    }, eventList => {
      $groupInfo.append(eventList);
    });

    _.forEach(
      _.omit(player.extra, 'anomaly', 'community', 'event'),
      (value: string[] | boolean, name: string) => {
        // allow two kinds of custom extra tags:
        // boolean & string
        // boolean: if array contains a true value, show name
        //          in $extraInfo
        // otherwise: show extra div etc.

        if (typeof value === 'boolean') {
          if (value) {
            $extraInfo.append(
              $('<span>').text(humanize(name))
            );
          }
          return;
        }

        $groupInfo.append(
          $('<div>')
            .addClass('iidentity-custom-extratag')
            .append(
              $('<b>').text(`${humanize(name)}:`)
            )
            .append(value.map(e => (
              $('<span>').text(_.capitalize(e.trim()))[0]
            )))
        )
      });

      callback(null, $elem);
  }, { match });
}

function createInlineElement(oid: string, match: string, callback: CreateCallback) {
  comm.getPlayer(oid, (err, player) => {
    if (err) {
      return callback(err, null);
    }

    const $wrapper = $('<span>')
      .addClass('iidentity-iwrapper')
      .attr('data-oid', oid)
      .append(
        $('<span>')
          .addClass('iidentity-name')
          .addClass(`iidentity-faction-${player.faction}`)
          .text(player.nickname)
      )
      .append(
        $('<span>')
          .addClass(`iidentity-level iidentity-level${player.level}`)
          .text('L' + (player.level === 0 ? '?' : `${player.level}`))
      );

    doForEach(player, 'anomaly', (anomaly: string) => {
      return $('<img>')
        .attr('src', chrome.extension.getURL(`img/anomalies/${anomaly}.png`))
        .attr('alt', capitalize(anomaly.replace(/_/g, ' '), true))
        .attr('title', capitalize(anomaly.replace(/_/g, ' '), true))
        .addClass('iidentity-anomaly');
    }, anomalyList => {
      $wrapper.append(
        $('<span>')
          .addClass('iidentity-anomalies')
          .append(anomalyList)
      );
    });

    callback(null, $wrapper);
  }, { match });
}

function createConciseInlineElement(oid: string, match: string, callback: CreateCallback) {
  comm.getPlayer(oid, (err, player) => {
    if (err) {
      return callback(err, null);
    }

    callback(null, $('<span>')
      .addClass('iidentity-ciwrapper')
      .addClass(`iidentity-faction-${player.faction}`)
      .attr('data-oid', oid)
      .text(player.nickname)
    );
  }, { match });
}

const handlers = Object.freeze([{
  matches: [
    'a.Ug[oid]', // profile pop-up
  ],
  handler($elem: JQuery, match: string) {
    const oid = $elem.attr('oid');

    createBlockElement(oid, match, (err, $infoElem) => {
      if (err) {
        if (err === 'not-found') {
          $elem
            .parent()
            .find(`.iidentity-wrapper[data-oid=${oid}]`)
            .remove()
          return;
        }

        log.error(err);
        return;
      }

      $elem
        .parent()
        .find(`.iidentity-wrapper[data-oid=${oid}]`)
        .remove()

      $elem.after($infoElem);
    });
  }
},
{
  matches: [
    // New Google+
    'c-wiz > .utPnCc' // profile pop-up
  ],
  handler($elem: JQuery, match: string) {
    const oid = $elem.find('[data-profileid]').eq(0).attr('data-profileid');

    createBlockElement(oid, match, (err, $infoElem) => {
      if (err) {
        if (err === 'not-found') {
          $elem
            .find(`.iidentity-wrapper[data-oid=${oid}]`)
            .remove();
          return;
        }

        log.error(err);
        return;
      }

      $elem
        .find(`.iidentity-wrapper[data-oid=${oid}]`)
        .remove();

      $elem.find('.Y7OA7b').after($infoElem);
    });
  }
}, {
  matches: [
    // 'a.ob.tv.Ub.Hf[oid]',            // post author, also on Google API
    // 'a.ob.tv.Ub.TD[oid]',            // comment author
    // 'a.ob.tv.Ub.ita[oid]',           // event creator
    'a.ob.tv.Ub[oid]',                  // event rsvp; also matches all previous entries
    'div.o0b[oid]',                     // friend lists on profile page
    'div.f5.wy > header > h3 > a[oid]', // comments in Google API

    // New Google+

    '.m3JvWd[data-profileid]',          // post author
    '.vGowKb[data-profileid]',          // comment author
  ],
  handler($elem: JQuery, match: string) {
    const oid = $elem.attr('oid') || $elem.attr('data-profileid');

    createInlineElement(oid, match, (err, $infoElem) => {
      if (err) {
        if (err === 'not-found') {
          $elem.parent()
            .find(`.iidentity-iwrapper[data-oid=${oid}]`).remove();
          return;
        }

        log.error(err);
        return;
      }

      $elem.parent()
        .find(`.iidentity-iwrapper[data-oid=${oid}]`).remove();

      $elem.after(
        $('<span class="iidentity-spacer">'), $('<wbr>'), $infoElem
      )
    });
  }
}, {
  matches: [
    'a.proflink.aaTEdf[oid]', // mentions (also on new Google+)
  ],
  handler($elem: JQuery, match: string) {
    const oid = $elem.attr('oid');

    createConciseInlineElement(oid, match, (err, $infoElem) => {
      if (err) {
        if (err === 'not-found') {
          $elem.parent()
            .find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();
          return;
        }

        log.error(err);
        return;
      }

      $elem.parent()
        .find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();

      $elem.after($('<span>').text(' '), $infoElem);
    });
  }
}, {
  matches: [
    'div.xTc.X8c', // members page of groups
  ],
  handler($elem: JQuery, match: string) {
    let oid: string;
    if ($elem.is('[oid]')) {
      oid = $elem.attr('oid');
    } else {
      const $oidCarrier = $elem.find('[oid]');

      if (!$oidCarrier.length) {
        return;
      }

      oid = $oidCarrier.first().attr('oid');
    }

    createConciseInlineElement(oid, match, (err, $infoElem) => {
      if (err) {
        if (err === 'not-found') {
          $elem.find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();
          return;
        }

        log.error(err);
        return;
      }

      $elem.find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();

      $elem.find('.l0d > .n0d').append($infoElem);
    });
  }
},
{
  matches: [
    // New Google+
    '.czUUib[data-memberid]' // members page of communities
  ],
  handler($elem: JQuery, match: string) {
    const oid = $elem.attr('data-memberid');

    createConciseInlineElement(oid, match, (err, $infoElem) => {
      if (err) {
        if (err === 'not-found') {
          $elem.find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();
          return;
        }

        log.error(err);
        return;
      }

      $elem.find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();

      $elem.find('.dw7uce').append($infoElem);
    });
  }
}, {
  matches: [
    'a > div.n291pb > img' // images in Google Talk
  ],
  handler($elem: JQuery, match: string) {
    $elem = $elem.parent().parent();

    const matches = $elem.attr('href').match(/https:\/\/plus\.google\.com\/(u\/0\/)?([0-9]+)\/about/);
    if (!matches) {
      return;
    }

    const oid = matches[2];
    const $root = $elem.closest('li.rI').find('div.vT');

    createConciseInlineElement(oid, match, (err, $infoElement) => {
      if (err) {
        if (err === 'not-found') {
          $root.find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();
          return;
        }

        log.error(err);
        return;
      }

      $root.find(`.iidentity-ciwrapper[data-oid=${oid}]`).remove();

      $root
        .addClass('iidentity-matched')
        .append($infoElement);
    });
  }
}]);

export default function checkElement(element: HTMLElement|Document) {
  const $root = (element === document) ? $(document) : $(element).parent();

  handlers.forEach(handler => {
    handler.matches.forEach(match => {
      $root.find(match).each(function () {
        doOnce(this, handler.handler, match);
      });
    });
  });
}
