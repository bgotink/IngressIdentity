/*
 * doOnce function
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

let timestamp = '0';

export default function doOnce(elem: HTMLElement|JQuery, callback: (elem: JQuery, ...args: any[]) => void, ...args: any[]) {
  const $elem = $(elem);

  if ($elem.attr('data-iidentity') === timestamp) {
    // already performed
    return;
  }

  $elem.attr('data-iidentity', timestamp);

  callback($elem, ...args);
}

export function update() {
  timestamp = `${Date.now()}`;
}

function getTimestamp() {
  return timestamp;
}

export { getTimestamp as timestamp };
