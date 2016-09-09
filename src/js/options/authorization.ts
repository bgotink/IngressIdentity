/*
 * Function to handle authorization
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { verifyToken } from './communication';

function toggleWarning(shown: boolean) {
  $('#alert-unauthorized').toggleClass('hide', !shown);
}

export default function init() {
  $('#alert-unauthorized').on('click', function () {
    verifyToken(true, authorized => {
      toggleWarning(!authorized);

      if (authorized) {
        $('#reload_sources').click();
      }
    });
  });

  verifyToken(false, authorized => {
    toggleWarning(!authorized);
  });
}