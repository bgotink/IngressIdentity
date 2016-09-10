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
import showPopup, { showOldPopup } from './popup';

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

function createOld(player: Player, wrapper: JQuery) {
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

function processAboutTabOld(oid: string) {
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

    createOld(player, $elem)
  });
}

function processProfileHeaderOld(oid: string) {
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
        showOldPopup('Save Player', 'gray', chrome.extension.getURL('export-single.html'));
      })
      .appendTo($headerButtons);
  });
}

function checkProfileOld() {
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

  processProfileHeaderOld(oid);
  processAboutTabOld(oid);
}

function addExportButton($container: JQuery, oid: string, name: string) {
  doOnce($container, $headerButtons => {
    $headerButtons.find('.iidentity-profile-badge').remove();

    const badgeUrl = chrome.extension.getURL('img/logo/profile-badge.png');

    $(`
      <div role="button" class="iidentity-profile-badge O0WRkf oG5Srb HQ8yf C0oVfc FjQgmf M9Bg4d j7nIZb" tabindex="0" aria-label="Export to IngressIdentity">
        <span class="RveJvd">
          <img class="b-c iidentity-profile-badge__image" src="${badgeUrl}" role="button"></img>
          <span class="iidentity-profile-badge__text">Export</span>
        </span>
      </div>
    `)
      .on('click', function () {
        comm.setExportData({ entries: [{ oid, name }] }, () => {
          showPopup(chrome.extension.getURL('export-single.html'));
        });
      })
      .appendTo($headerButtons);
  });
}

const popupHelpers = Object.freeze({
  createItem(): JQuery {
    return $('<div class="FPE87d"></div>');
  },

  createSpacer(): JQuery {
    return $('<div class="pOau1d"></div>');
  },

  createGeneralInformation(title: string, value: string): JQuery {
    return $(`
    <div class="uqKsgd iidentity-popup__geninfo-entry" role="list">
      <div role="heading" aria-level="2" class="zqU9Fe">
        ${title}
      </div>
      <div role="listitem" class="BgK4Ef ">
        <div class="mGa2db">
          <div class="DOdATc">
            ${value}
          </div>
        </div>
      </div>
    </div>
    `);
  },
});

function createPopupEntry(player: Player): JQuery {
  const $elem = $(`
  <div class="jmOUCb iidentity-popup-entry" role="region" aria-label="Ingress" style="opacity: 1; transform: translateY(0);">
    <div role="heading" aria-level="1" class="o30VSc">Ingress</div>
  </div>
  `);

  const $generalInfo = popupHelpers.createItem().addClass('iidentity-popup__geninfo');

  $generalInfo.append(
    popupHelpers.createGeneralInformation(translate('agentName'), player.nickname),
    popupHelpers.createGeneralInformation(translate('level'), translate('levelValue', { value: (player.level === 0 ? '?' : `${player.level}`) })),
    popupHelpers.createGeneralInformation(translate('faction'), translate(player.faction))
  );

  if (!_.isEmpty(player.extra)) {
    $generalInfo.append.apply($generalInfo,
      Object.keys(player.extra)
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

          return popupHelpers.createGeneralInformation(
            humanize(key),
            _.capitalize((Array.isArray(value) ? value[0] : value).trim())
          );
        })
    );
  }

  $elem.append($generalInfo);

  // .append(popupHelpers.createSpacer())

  return $elem;
}

function processAboutPopup($popup: JQuery, oid: string) {
  // The popup stays open if we click on other users
  // So we need to "doOnce" twice: once to set everything up
  // and once per user (e.g. if we're clicking through to people in common)
  // -> use $popup for the setup doOnce & the name element for the other
  const dot = timestamp();

  doOnce($popup, $container => {
    function verifyActive() {
      const foundDot = $container.attr('data-iidentity');

      if (foundDot === dot) {
        return true;
      }

      $container.off(`.iidentity-${dot}`);

      return false;
    }

    let previousOid: string = '';

    function addPlayerAbout(oid: string, repeatCount = 0) {
      // First verify that the timestamp on the popup hasn't changed
      if (!verifyActive()) {
        // we got an update!
        // abort, we don't want to get in its way
        return;
      }

      log.log('Creating player about section for', oid);

      const $dotRoot = $container.find('.qsScTb');

      if (!$dotRoot.length || $dotRoot.attr('data-oid') === previousOid || !$container.find('.Rgr1Jc').length) {
        // not ready yet
        log.log('Not ready yet...');
        if (repeatCount < 600) { // should be plenty of time while being reasonable on the processor
          log.log('Retrying in setTimeout');
          requestAnimationFrame(() => addPlayerAbout(oid, repeatCount + 1));
        }
        return;
      }

      if ($dotRoot.attr('data-iidentity') === dot) {
        // already processed
        return;
      }
      $dotRoot.attr('data-iidentity', dot).attr('data-oid', oid);
      previousOid = oid;

      log.log('Checking if player with oid %s exists', oid);
      comm.getPlayer(oid, (err, player) => {
        if (!verifyActive()) {
          // we got an update!
          // abort, we don't want to get in its way
          return;
        }

        if (err) {
          // leave the timestamp

          if (err === 'not-found') {
            log.log('No such player found');
            return;
          }

          log.error(err);
          return;
        }

        log.log('Player found:', player);

        $container.find('.iidentity-popup-entry').remove();
        $container.find('.Rgr1Jc').after(createPopupEntry(player));
      });
    }

    $container.on(`click.iidentity-${dot}`, '[data-id]', function () {
      const oid = $(this).attr('data-id');
      requestAnimationFrame(() => addPlayerAbout(oid));
    });

    addPlayerAbout(oid);
  });
}

export default function checkProfile() {
  if ($('#contentPane div[role="tabpanel"]').length) {
    checkProfileOld();
    return;
  }

  const $header = $('.aPExg .t1KkGe.hKA5zb .gBPe9b');
  const $oid = $header.find('.IGqcid [data-oid]');
  const $name = $header.find('.toHbGf');
  const $buttons = $header.find('.qUtIfb > .DZ7mXe');

  if (!$oid.length || !$buttons.length || !$name.length) {
    // profile not active
    return;
  }

  const oid = $oid.attr('data-oid');

  addExportButton($buttons, oid, $name.text());

  const $popup = $('c-wiz.HqF2de.eejsDc');
  if (!$popup.length) {
    // profile pop-up is not active
    return;
  }

  processAboutPopup($popup, oid);
}