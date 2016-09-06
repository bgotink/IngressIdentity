/*
 * Including this file will automatically translate the page when applicable.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */
'use strict';

import _ from 'lodash';

let prefix: string = '';

export default function translate(name: string, placeholders?: { [s: string]: any }): string {
  let message = chrome.i18n.getMessage(`${prefix}${name}`);

  if (!placeholders) {
    return message;
  }

  return message.replace(/\{\s*([^}]+\s*)\}/g, (match: string, placeholderName: string): string => {
    return placeholders[placeholderName] || match;
  });
}

// function to get all attributes of an element
function getAttributes($element: JQuery): { [s: string]: string } {
  if ($element.length === 0) {
    return {};
  }

  const { attributes } = $element.get(0);
  const l = attributes.length;
  const result: { [s: string]: string } = {};

  for (let i = 0; i < l; i++) {
    const { nodeName, value } = attributes.item(i);
    result[nodeName] = value;
  }

  return result;
};

$($ => {
  const $html = $('html');

  if ($html.attr('data-translate-prefix')) {
    prefix = `${$html.attr('data-translate-prefix')}_`;
  }

  $('[data-translate-name]').each(function () {
    const $this = $(this);
    let placeholders: { [s: string]: string } = null;

    if ($this.attr('data-translate-placeholders') === 'true') {
      const attrs = _.pickBy(getAttributes($this), (value, key) => /^data-translate-placeholder-/.test(key));
      placeholders = {};

      _.forEach(attrs, (name, value) => {
        placeholders[name.slice(27)] = value;
        // 27 = 'data-translate-placeholder-'.length
      });
    }

    $this.html(translate($this.attr('data-translate-name'), placeholders));
  });
});
