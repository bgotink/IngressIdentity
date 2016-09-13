/*
 * The main script for Google Talk pages
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import * as log from '../log';
import { setOnUpdate } from '../communication';

import checkElement from './mentions';
import { update as updateDoOnceTimestamp } from './doOnce';

const selfTimestamp = `${Date.now()}`;

// use $root instead of document.body, because we don't want to fire our
// listeners every time the user types a character.
let $root: JQuery;

const selfDestructObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.type !== 'attributes' || mutation.attributeName !== 'data-iidentity-timestamp') {
      return;
    }

    const newTimestamp = $(mutation.target).attr('data-iidentity-timestamp')

    if (newTimestamp === selfTimestamp) {
      return;
    }

    log.info('Self-destructing', selfTimestamp, 'due to loading of second extension instance', newTimestamp);

    // stop this extension
    observer.disconnect();
    setOnUpdate(function () {})

    selfDestructObserver.disconnect();
  });
});

function forceUpdate() {
  updateDoOnceTimestamp();

  checkElement($root[0]);
}

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    Array.prototype.forEach.call(mutation.addedNodes, checkElement);
  });
});

$($ => {
  // Install self destruct observer
  $(document.body).attr('data-iidentity-timestamp', selfTimestamp);
  selfDestructObserver.observe(document.body, { attributes: true });

  $root = $('.Xg .Xg');
  if ($root.length === 0) {
    // this is not a chat pane, but the main talk frame on the right
    $root = $(document.body);
  }

  setOnUpdate(forceUpdate);

  forceUpdate();
  observer.observe($root[0], { childList: true, subtree: true });
});
