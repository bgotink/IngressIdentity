/*
 * The main script for the options page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import showAlert from './alerts';
import * as comm from './communication';
import { initManifests, reloadManifests } from './manifests';
import { initSettings, updateSettings } from './settings';
import initAuthorization from './authorization';

$($ => {
  // make enter submit a form
  $('form input[type="text"]').on('keypress', function (e) {
    if (e.which !== 13) {
      return undefined;
    }

    $(this).closest('form').submit();
    return false;
  });

  $('#reload_sources').on('click', function () {
    const $this = $(this);

    $this.button('loading');
    comm.reloadData(result => {
      showAlert(`reload-${result}`);
      $this.button('reset');
    });
  });

  initManifests();
  initSettings();
  initAuthorization();

  comm.setOnUpdate(() => {
    reloadManifests();
    updateSettings();
  });
});
