/*
 * Function to show an alert
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { log } from '../log';

export default function showAlert(id: string): void {
  log('showing alert %s', id);

  $('.alert').addClass('hide');
  $(`.alert-${id}`).removeClass('hide');
}

$($ => {
  $('.alert > .close').on('click', function () {
    $(this).parent().addClass('hide');
  });
});
