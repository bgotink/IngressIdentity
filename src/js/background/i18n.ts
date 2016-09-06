/*
 * Rewrite Google's i18n because it doesn't allow fetching data
 * from a different language than the UI default.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import _ from 'lodash';

import { error as logError } from '../log';

interface Message {
  message: string;
  description: string;
}

type MessageHash = { [s: string]: Message };
export type ExtractedMessageHash = { [s: string]: string };

interface Locale {
  finished: boolean;
  callbacks?: (() => void)[];
  data?: MessageHash;
}

type Placeholders = { [s: string]: string };

const loadedLocales: { [s: string]: Locale } = {};
const defaultLocale = 'en';

const localeHelper = {
  isLoaded(locale: string) {
    return loadedLocales[locale] && loadedLocales[locale].finished;
  },

  load(locale: string, callback: () => void) {
    if (this.isLoaded(locale)) {
      return callback();
    }

    if (loadedLocales[locale]) {
      // We're already loading it
      loadedLocales[locale].callbacks.push(callback);
      return;
    }

    const loadedLocale: Locale = loadedLocales[locale] = {
      finished: false,
      callbacks: [ callback ]
    };

    function setData(data: MessageHash) {
      // first set the data
      loadedLocale.data = data;

      // then let the world know it's loaded
      loadedLocale.finished = true

      // finally call the callbacks
      loadedLocale.callbacks.forEach(callback => callback());
      delete loadedLocale.callbacks;
    }

    $.ajax({
      type: 'GET',
      dataType: 'json',
      url: chrome.extension.getURL(`_locales/${locale}/messages.json`),

      success: setData,

      error(xhr) {
        if (xhr.status !== 404) {
          // a true error...
          logError('Something went wrong while getting locale file: ', xhr.statusText);
          logError('XHR:', xhr);
        }

        // set empty data
        setData({});
      }
    });
  },

  // simply get the message, calling callback(true, message) or callback(false)
  // depending on whether the message was found
  getMessage(locale: string, name: string, callback: (found: boolean, message?: Message) => void) {
    this.load(locale, () => {
      if (loadedLocales[locale].data[name]) {
        callback(true, loadedLocales[locale].data[name]);
      } else {
        callback(false);
      }
    });
  },

  // get all messages with a given prefix in a given loale
  getPrefixedMessages(locale: string, prefix: string, callback: (messages: ExtractedMessageHash) => void) {
    this.load(locale, () => {
      const prefixRe = new RegExp(`^${prefix}_`);
      const data = <MessageHash> _.pickBy(loadedLocales[locale].data, (value, key) => prefixRe.test(key));
      const offset = prefix.length + 1;

      const result: ExtractedMessageHash = {};
      _.forEach(data, (v, k) => {
        result[k.slice(offset)] = v.message;
      });

      callback(result);
    });
  },

  // get the message, fallback to other locale if not found
  getMessageWithFallbacks(locales: string[], name: string, callback: (found: boolean, message?: Message) => void) {
    if (locales.length === 0) {
      return callback(false);
    }

    this.getMessage(_.first(locales), name, (found, message) => {
      if (found) {
        return callback(true, message);
      }

      this.getMessageWithFallbacks(locales.slice(1), name, callback);
    });
  },

  // get all prefixed messages, with fallbacks to other locales
  getPrefixedMessagesWithFallbacks(locales: string[], prefix: string, callback: (messages: ExtractedMessageHash) => void, state: ExtractedMessageHash = {}) {
    if (locales.length === 0) {
      return callback(state);
    }

    this.getPrefixedMessages(_.first(locales), prefix, messages => {
      const newState = <ExtractedMessageHash> _.assign({}, state, messages);
      this.getPrefixedMessagesWithFallbacks(locales.slice(1), prefix, callback, newState);
    });
  }
};

function getFallbackLocales(locale: string) {
  const locales = [ locale ];

  if (locale.indexOf('_') !== -1) {
    locales.push(locale.slice(0, locale.indexOf('_')));
  }

  locales.push(defaultLocale);

  return locales;
}

export function getMessage(locale: string, name: string, placeholders: Placeholders, callback: (found: boolean, message: string) => void) {
  localeHelper.getMessageWithFallbacks(getFallbackLocales(locale), name, (found, message) => {
    if (!found) {
      return callback(false, name);
    }

    // TODO do the placeholder stuff
    callback(true, message.message);
  });
}

export function getPrefixedMessages(locale: string, prefix: string, callback: (messages: ExtractedMessageHash) => void) {
  localeHelper.getPrefixedMessagesWithFallbacks(getFallbackLocales(locale), prefix, callback);
}
