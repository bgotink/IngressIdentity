/**
 * The main script for the help page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import $ from 'jquery';
import 'bootstrap';
import _ from 'lodash';

$($ => {
  $('body').scrollspy({ target: '.help-nav' });

  $('#manifest_url').on('keyup', function () {
    let url: string = $(this).val().trim();
    const $result = $('#manifest_key');

    // oldSheet: 'https://docs.google.com/spreadsheet/ccc?key={key}'
    // newSheet: 'https://docs.google.com/spreadsheets/d/{key}'

    if (!_.startsWith(url, 'https://docs.google.com/spreadsheet')) {
      if (_.startsWith('https://docs.google.com/spreadsheet', url)) {
        $result.val('');
      } else {
        $result.val('Invalid URL');
      }

      return;
    }

    url = url.slice(35); // 'https://docs.google.com/spreadsheet'.length

    let gidMatch = url.match(/[#?&]gid=(.*)([#&]|$)/);
    let gid: string = '';
    if (gidMatch) {
      gid = gid[1];
      if (0 !== +gid) {
        gid = `&gid=${gid}`;
      } else {
        gid = '';
      }
    }

    if (_.startsWith(url, '/ccc?')) {
      // ye olde URL style
      const matches = url.match(/\?(.*&)?key=([^&#]*)([#&]|$)/)

      if (matches) {
        $result.val(matches[2] + gid);
      } else {
        $result.val('Invalid URL');
      }
    } else if (_.startsWith(url, '/s/d')) {
      // new URL style
      url = url.slice(4); // 's/d/'.length

      $result.val(url.replace(/[#?/].*$/, '')) + gid
    }
  });

  $('#oid_url').on('keyup', function () {
    let url: string = $(this).val().trim();
    const $result = $('#oid_oid');

    if (!_.startsWith(url, 'https://plus.google.com/')) {
      if (_.startsWith('https://plus.google.com/', url)) {
        $result.val('');
      } else {
        $result.val('Invalid URL');
      }

      return;
    }

    url = url.slice(24); // 'https://plus.google.com/'.length

    if (_.startsWith(url, 'u/0/')) {
      url = url.slice(4); // 'u/0/'.length
    }

    const type = url.slice(0, url.indexOf('/'));

    if (type === 'events' || type === 'communities') {
      url = url.slice(type.length + 1);

      $result.val(url.replace(/[#?/].*$/, ''));
    } else {
      url = url.replace(/[#?/].*$/, '');

      if (url.match(/[0-9]{21}/)) {
        $result.val(url);
      } else {
        $result.val('Invalid URL');
      }
    }
  });
});
