/*
 * Gets and stores the settings
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import $ from 'jquery';
import _ from 'lodash';
import { Settings } from 'ingress-identity';

import * as comm from './communication';
import * as log from '../log';

const currentSettings: Settings = {
  match: {},
  show: {},
  'own-oid': ''
};

export function updateSettings() {
  $('input[data-match]').each(function () {
    const attr = $(this).attr('data-match');

    comm.getOption(`match-${attr}`, true, (state: boolean) => {
      this.checked = state;
      currentSettings.match[attr] = state;
    });
  });

  $('input[data-show]').each(function () {
    const attr = $(this).attr('data-show');

    comm.getOption(`show-${attr}`, (attr !== 'hide-self'), (state: boolean) => {
      this.checked = state;
      currentSettings.show[attr] = state;

      if (attr === 'hide-self') {
        $('.own-oid > input').prop('disabled', !state);
      }
    });
  });

  comm.getOption('own-oid', '', oid => {
    $('.own-oid > input').val(oid);
    currentSettings['own-oid'] = oid;
  });
}

function findChangedOptions(): Settings|void {
  const newSettings: Settings = {
    match: {},
    show: {},
    'own-oid': ''
  };

  $('input[data-show]').each(function () {
    newSettings.show[$(this).attr('data-show')] = this.checked;
  });
  $('input[data-match]').each(function () {
    newSettings.match[$(this).attr('data-match')] = this.checked;
  });

  newSettings['own-oid'] = $('.own-oid > input').val();

  log.log('Old settings state', currentSettings, 'new settings state', newSettings);

  if (!newSettings.show['hide-self'] || currentSettings['own-oid'] === newSettings['own-oid']) {
    delete newSettings['own-oid'];
  }

  _.forEach(currentSettings.match, (value: boolean, key: string) => {
    if (value === newSettings.match[key]) {
      delete newSettings.match[key];
    }
  });

  if (_.isEmpty(newSettings.match)) {
    delete newSettings.match;
  }

  _.forEach(currentSettings.show, (value: boolean, key: string) => {
    if (value === newSettings.show[key]) {
      delete newSettings.show[key];
    }

    if (_.isEmpty(newSettings.show)) {
      delete newSettings.show;
    }
  });

  if (_.isEmpty(newSettings)) {
    log.log('No settings have been changed');
    return;
  }

  log.log('Found changed settings:', newSettings);
  return newSettings;
}

function save() {
  const changes = findChangedOptions();

  if (!changes) {
    // no changes -> nothing to save
    return;
  }

  const $button = $('.settings button');
  const $inputs = $('.settings input');

  $button.prop('disabled', true);
  $inputs.prop('disabled', true);

  comm.setOptions(changes, () => {
    updateSettings();

    $button.prop('disabled', false);
    $inputs.prop('disabled', false);
  });
}

function onSettingChanged() {
  $('.settings button').prop('disabled', !findChangedOptions());
  $('.own-oid input').prop('disabled', !$('input[data-show="hide-self"]').is(':checked'));
}

export function initSettings() {
  $('input[data-match], input[data-show]').on('change', onSettingChanged);
  $('.own-oid > input').on('change', onSettingChanged);

  $('.settings button').on('click', save);

  updateSettings();
}
