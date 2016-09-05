/*
 * translation function
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import $ from 'jquery';

import { getTranslationsWithPrefix } from '../communication';

// we can cache this, as a change in the language is only effective
// after reloading the page
let messages: { [s: string]: string } = null;

const locale = $(window.top.document).find('html').attr('lang');

export function init(callback: () => void) {
  getTranslationsWithPrefix(locale, 'content', msg => {
    messages = msg;
    callback();
  });
}

export default function getMessage(name: string, placeholders?: { [s: string]: string }) {
  const message = messages[name] || name;

  if (placeholders) {
    return message.replace(/\{[^}]+\}/g, (match: string, placeholderName: string) => {
      return placeholders[placeholderName] || match;
    });
  } else {
    return message;
  }
}
