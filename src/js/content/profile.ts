/*
 * Check if profile page and act accordingly
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Player, CommunityOrEvent } from 'ingress-identity';
import translate from './i18n';
import _ from 'lodash';

import capitalize from 'sugar/string/capitalize';
import pluralize from 'sugar-inflections/string/pluralize';
import humanize from 'sugar-inflections/string/humanize';

import doOnce, { timestamp } from './doOnce';
import * as log from '../log';
import * as comm from '../communication';
import showPopup from './popup';

function ensureArray<T>(value: T|T[]): T[] {
  return Array.isArray(value) ? value : [ value ];
}

// find the smallest of a list of elements
// smallest = lowest height
function getSmallest($element: JQuery): JQuery {
  if ($element.length === 0) {
    return $element;
  }

  let smallest: JQuery = null;
  let smallestHeight = Infinity;

  $element.each(function () {
    const $this = $(this), height = $this.height();
    if (height < smallestHeight) {
      smallestHeight = height;
      smallest = $this;
    }
  });

  return smallest;
}

const helper = Object.freeze({
  createWrapper() {
    return $(`
      <div class="Ee h5a vna iidentity-profile-wrapper" role="article">
          <div class="ZYa ukoEtf">
              <div class="Lqc">
                  <div class="F9a">${translate('profileTitle')}</div>
                  <div class="miIoOb Cdmn9d"></div>
              </div>
          </div>
          <div class="Uia"><div class="iec Iqc iidentity-profile"></div></div>
          <div class="Iqc"></div>
      </div>
    `);
  },

  createTable(rows: JQuery|JQuery[]) {
    return $('<div class="Qqc wna"></div>').append(rows);
  },

  createRow(left: string, right: string) {
    return $(`
      <div class="wna DVb">
          <div class="E9a G9a Rqc">${left}</div>
          <div class="y4 G9a">${right}</div>
      </div>
    `);
  },

  createAnomalySubtitle(anomalies: string[]) {
    return $('<div class="wna fa-TCa Ala">')
      .append(
        $(`<div class="Cr Aha">${translate('anomalies')}</div>"`)
      )
      .append(
        $('<div class="y4">')
          .append(
            $('<ul class="Kla yVa">')
              .append(
                $(anomalies.map(anomaly => {
                  const nice = capitalize(anomaly.replace(/_/g, ' '), true);

                  return $('<li>')
                    .append(
                      $('<img>')
                        .addClass('xfa')
                        .attr('src', chrome.extension.getURL(`img/anomalies/${anomaly}.png`))
                        .attr('title', nice)
                        .attr('alt', '')
                    )
                    .append(
                      $('<div class="fIa s">')
                        .append(
                          $('<span class="OLa Xvc"></span>').text(nice)
                        )
                    )
                    [0]
                }))
              )
          )
      );
  },

  createSubtitle(subtitle: string, items: JQuery|JQuery[]) {
    return $('<div class="wna fa-TCa Ala">')
      .append(
        $('<div class="Cr Aha"></div>').text(subtitle)
      )
      .append(
        $('<div class="y4"></div>')
          .append(
            $('<ul class="Kla yVa">')
              .append($(items))
          )
      );
  },

  createLinkedSubtitle(subtitle: string, links: CommunityOrEvent[], baseUrl: string) {
    return helper.createSubtitle(subtitle, $(links.map(link => {
      const url = baseUrl + link.oid.trim();
      const title = link.name.trim();

      return $('<li>')
        .append(link.image
          ? $('<img>')
              .addClass('xfa')
              .attr('src', link.image)
              .attr('title', title)
              .attr('alt', '')
          : $('<div>').addClass('xfa')
        )
        .append(
          $('<div class="fIa s">')
            .append(
              $('<a class="OLa url Xvc">')
                .text(title)
                .attr('title', title)
                .attr('href', url)
            )
        )
        [0];
    })));
  }
});

function create(player: Player, wrapper: JQuery) {
  const $wrapper = $(wrapper);
  const $profile = $wrapper.find('.iidentity-profile');

  if (player.faction === 'enlightened') {
    $wrapper.removeClass('Mqc').addClass('Hqc');
  } else if (player.faction === 'resistance') {
    $wrapper.removeClass('Hqc').addClass('Mqc');
  } else {
    $wrapper.removeClass('Hqc Mqc');
  }

  $wrapper
    .removeClass('iidentity-faction-enlightened iidentity-faction-resistance iidentity-faction-error iidentity-faction-unknown')
    .addClass(`iidentity-faction-${player.faction}`);

  $profile
    .html('')
    .append(
      helper.createTable(
        [
          helper.createRow(translate('agentName'), player.nickname),
          helper.createRow(translate('level'), translate('levelValue', { value: (player.level === 0 ? '?' : `${player.level}`) })),
          helper.createRow(translate('faction'), translate(player.faction))
        ].concat(
          ! player.extra ? [] : Object.keys(player.extra)
            .filter(key => {
              let value = player.extra[key];

              if (Array.isArray(value)) {
                if (value.length !== 1) {
                  return false;
                }

                return typeof value[0] === 'string';
              }

              return typeof value === 'string';
            })
            .map(key => {
              const value = player.extra[key] as string[];

              return helper.createRow(
                humanize(key),
                _.capitalize((Array.isArray(value) ? value[0] : value).trim())
              );
            })
        )
      )
    );

    if (player.anomaly.length) {
      $profile.append(
        helper.createAnomalySubtitle(player.anomaly)
      );
    }

    if (player.community.length) {
      $profile.append(
        helper.createLinkedSubtitle(
          translate('communities'),
          player.community,
          'https://plus.google.com/communities/'
        )
      );
    }

    if (player.event.length) {
      $profile.append(
        helper.createLinkedSubtitle(
          translate('events'),
          player.event,
          'https://plus.google.com/events/'
        )
      );
    }

    if (player.errors && player.errors.length > 0) {
      $profile.append(
        helper.createSubtitle(
          translate('errors'),
          $(ensureArray(player.errors).map(err => (
            $('<div class="fIa s"></div>').text(err)[0]
          )))
        )
      );
    }

    Object.keys(player.extra)
      .filter(key => {
        const value = player.extra[key];

        return Array.isArray(value) && value.filter((val: any) => typeof val === 'string').length > 0;
      })
      .forEach(key => {
        $profile.append(
          helper.createSubtitle(
            pluralize(humanize(key)),
            $((player.extra[key] as string[]).map((value: string) => (
              $('<div class="fIa s">').text(value)[0]
            )))
          )
        );
      });
}

function processAboutTab(oid: string) {
  // we use $root as timestamp if the user doesn't exist,
  // and $elem if he does

  let $root = $(`#${oid}-about-page`);
  let dot = timestamp();

  // own profile page uses slightly different IDs
  if ($root.length === 0) {
    $root = $(`#${oid}-co-about-page`);
  }

  if ($root.length === 0 || $root.is('.o-xc-Bd')) {
    // profile tab isn't shown
    return;
  }

  let $elem = $root.find('div.iidentity-profile-wrapper');

  if ($root.attr('data-iidentity') === dot) {
    // already checked, user is not a player...
    return;
  }

  if ($elem.length && $elem.attr('data-iidentity') === dot) {
    // already checked, user is a player
    return;
  }

  // set on root to stop duplicate calls
  $root.attr('data-iidentity', dot);

  log.log('Checking if player with oid %s exists', oid);
  comm.getPlayer(oid, (err, player) => {
    if ($root.attr('data-iidentity') !== dot) {
      // we got an update!
      // abort, we don't want to get in its way
      return;
    }

    if (err) {
      // leave the timestamp on $root

      if (err === 'not-found') {
        log.log('No such player found');
        return;
      }

      log.error(err);
      return;
    }

    log.log('Player found:', player);

    if ($elem.length === 0) {
      log.log('Creating profile wrapper');
      $elem = helper.createWrapper();
      getSmallest($root.find('div.Ypa.jw.am'))
        .prepend($elem);
    } else {
      log.log('Re-using existing profile wrapper')
    }

    // switch to $elem for timestamping
    $elem.attr('data-iidentity', dot);
    $root.attr('data-iidentity', null);

    create(player, $elem)
  });
}

function processProfileHeader(oid: string) {
  doOnce($('.ckb.b4a'), $headerButtons => {
    $headerButtons.find('.iidentity-profile-badge').remove();

    const badgeUrl = chrome.extension.getURL('img/logo/profile-badge.png');

    $(`
      <div class="bZa Mrc iidentity-profile-badge">
          <img class="b-c" src="${badgeUrl}" role="button" aria-label="IngressIdentity"></div>
      </div>
    `)
      .on('click', function () {
        const data = {
          oid, name: $('[guidedhelpid="profile_name"]').text()
        };

        comm.send({ type: 'setExportData', data });
        showPopup('Save Player', 'gray', chrome.extension.getURL('export-single.html'));
      })
      .appendTo($headerButtons);
  });
}

export default function checkProfile() {
  const $tabs = $('#contentPane div[role="tabpanel"]');

  if ($tabs.length === 0) {
    // not a profile!
    return;
  }

  let oid = $tabs.first().attr('id');
  oid = oid.slice(0, oid.indexOf('-'));

  if (oid.length !== 21) {
    log.error('Invalid oid: %s', oid);
    return;
  }

  processProfileHeader(oid);
  processAboutTab(oid);
}
