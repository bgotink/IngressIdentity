/*
 * The main content script
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

/*
 * Use the following script on G+ pages to identify the elements containing a 'oid' attribute:
 *
 * (function () {
 * var result = {}, elems = document.querySelectorAll('[oid]'), i, length = elems.length, elem, key;
 * for(i = 0; i < length; i++) {
 *     elem = elems.item(i);
 *     key = elem.tagName.toLowerCase() + '.' + elem.className.split(' ').join('.');
 *     if (key in result) {
 *         result[key] ++;
 *     } else {
 *         result[key] = 1;
 *     }
 * }
 * console.log(result);
 * })();
 */

import * as log from '../log';
import { setOnUpdate } from '../communication';

import checkProfile from './profile';
import listSources from './source';
import addExport from './export';
import checkElement from './mentions';
import { update as updateDoOnceTimestamp } from './doOnce';
import { init as initI18n } from './i18n';

const selfTimestamp = `${Date.now()}`;

const observer = new MutationObserver(mutations => {
  checkProfile();
  listSources();
  addExport();

  mutations.forEach(mutation => {
    Array.prototype.forEach.call(mutation.addedNodes, checkElement);
  });
});

const selfDestructObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.type !== 'attributes' || mutation.attributeName !== 'data-iidentity-timestamp') {
      return;
    }

    const newTimestamp = $(mutation.target).attr('data-iidentity-timestamp');

    if (newTimestamp === selfTimestamp) {
      return;
    }

    log.info('Self-destructing', selfTimestamp, 'due to loading of second extension instance', newTimestamp);

    // stop this extension
    observer.disconnect();
    setOnUpdate(function () {});

    selfDestructObserver.disconnect();
  });
});

function forceUpdate() {
  updateDoOnceTimestamp();

  checkProfile();
  listSources();
  addExport();

  checkElement(window.document);
}

$($ => {
  // Install self destruct observer
  $(document.body).attr('data-iidentity-timestamp', selfTimestamp);
  selfDestructObserver.observe(document.body, { attributes: true });

  // Install i18n
  initI18n(() => {
    setOnUpdate(forceUpdate);

    forceUpdate();
    observer.observe(document, { childList: true, subtree: true });
  });
});
