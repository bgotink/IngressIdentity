/* The main background script, containing listeners for communication, aggregating
 * the data and storing it.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Status, ManifestInformation, ExportData } from 'ingress-identity';
import _ from 'lodash';
import * as log from './log';
import Cache from './background/cache';
import { getPrefixedMessages } from './background/i18n';

import DataManager from './data/index';
import TokenBearer from './data/token';

const optionsPage = `chrome-extension://${chrome.runtime.id}/options.html`;
const optionsPageRegexp = new RegExp(`chrome-extension://${chrome.runtime.id}/options.html`);

const tokenBearer = new TokenBearer();
let data = new DataManager(tokenBearer, []);

/*
 * Storage functions
 */

// Use sync storage to sync the stored data between chrome instances for the logged on user
const storage = chrome.storage.sync;
const storageCache = new Cache<any>();

let disableUpdateListener = false;
chrome.storage.onChanged.addListener(function onDataUpdated(changes) {
  if (disableUpdateListener) {
    log.log('Chrome storage update listener was disabled, re-enabling');
    disableUpdateListener = false;
    return;
  }

  let reload = false, update = false;

  log.log('Settings updated:');
  _.forEach(changes, (value, key) => {
    if (storageCache.has(key)) {
      storageCache.remove(key);
    }

    log.log(`- %s`, key);

    if (key === 'manifest_keys') {
      reload = true;
    }

    update = true;
  });

  if (reload) {
    reloadData();
  } else if (update) {
    updateTabs();
  }
});

async function getStoredData<T>(key: string, defaultValue: T): Promise<T> {
  if (storageCache.has(key)) {
    const result = await storageCache.get(key) as Promise<T>;
    log.log('Got data { key: %s, value: %s } from storage cache', key, `${result}`);
    return result;
  }

  const result = new Promise<T>((resolve, reject) => {
    storage.get({ [key]: defaultValue }, (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      log.log('Got data { key: %s, value: %s } from storage', key, `${result[key]}`);
      resolve(result[key] as T);
    });
  });

  // Store this in the cache, but remove it if errored
  storageCache.set(key, result);
  result.catch(() => storageCache.remove(key));

  return result;
}

async function setStoredData<T>(key: string, value: T): Promise<void> {
  log.log('Setting storage key %s to %s', key, value);
  return new Promise<void>((resolve, reject) =>
    storage.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError.message);
      }

      resolve();
    })
  );
}

async function setStoredDatas(data: { [s: string]: any }): Promise<void> {
  log.log('Settings multiple storage values:', data);
  return new Promise<void>((resolve, reject) => {
    storage.set(data, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError.message);
      }

      resolve();
    });
  });
}

async function getManifestKeys(): Promise<string[]> {
  log.log('Fetching manifest keys...');
  return new Promise<string[]>((resolve, reject) => {
    storage.get({ manifest_keys: [] }, (result: { manifest_keys: string[] }) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError.message);
      }

      resolve(result.manifest_keys);
    });
  });
}

async function setManifestKeys(keys: string[]): Promise<void> {
  log.log('Setting manifest keys...');
  return new Promise<void>((resolve, reject) => {
    storage.set({ manifest_keys: keys }, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError.message);
      }

      resolve();
    })
  });
}

async function addManifestKey(key: string, name: string): Promise<boolean> {
  const keys = await getManifestKeys();
  
  if (keys.includes(key)) {
    log.log('manifest key %s already loaded', key);
    return false;
  }

  log.log('adding manifest key %s', key);
  keys.push(key);

  await setManifestKeys(keys);

  if (_.isEmpty(name)) {
    return true;
  }

  const names = await getStoredData<{ [s: string]: string }>('manifest_names', {});
  names[key] = name;
  await setStoredData('manifest_names', names);

  return true;
}

async function removeManifestKey(key: string): Promise<boolean> {
  const keys = await getManifestKeys();
  const idx = keys.indexOf(key);

  if (idx === -1) {
    return false;
  }

  keys.splice(idx, 1);
  await setManifestKeys(keys);

  return true;
}

async function renameManifest(key: string, oldName?: string, newName?: string): Promise<boolean> {
  if (_.isEmpty(oldName) && _.isEmpty(newName)) {
    return true;
  }

  if (`${oldName}`.trim() === `${newName}`.trim()) {
    return true;
  }

  const names = await getStoredData<{ [s: string]: string }>('manifest_names', {});

  // Verify that there's been no change in the mean time
  if (_.isEmpty(oldName)) {
    if (names[key]) {
      return false;
    }
  } else {
    if (names[key] !== oldName) {
      return false;
    }
  }

  if (_.isEmpty(newName)) {
    delete names[key];
  } else {
    names[key] = newName;
  }

  await setStoredData('manifest_names', names);
  storageCache.remove('manifests');

  return true;
}

async function changeManifestOrder(oldOrder: string[], newOrder: string[]): Promise<Status> {
  const currentOrder = await getManifestKeys();
  const { length } = currentOrder;

  if (oldOrder.length !== length || newOrder.length !== length) {
    // What the hell is happening? Abort, abort!
    return 'failed';
  }

  // Check if the old order is the current order (make sure no intermediary changes have been made)
  for (let i = 0; i < length; i++) {
    if (oldOrder[i] !== currentOrder[i]) {
      return 'failed';
    }
  }

  // Verify that the contents of the two orders are the same except for the order of the elements
  for (let i = 0; i < length; i++) {
    if (!oldOrder.includes(newOrder[i]) || !newOrder.includes(oldOrder[i])) {
      return 'failed';
    }
  }

  await setManifestKeys(newOrder);
  return 'success';
}

/*
 * Data functions
 */

async function reloadData(): Promise<Status> {
  const keys = await getManifestKeys();
  const newData = new DataManager(tokenBearer, keys);

  await newData.ready();

  data = newData;

  updateTabs();
  return (await data.hasErrors()) ? 'success' : 'warning';
}

/*
 * Communication functions
 */

function updateTabs() {
  chrome.tabs.query({}, (tabs) => {
    log.log('Sending update message to %d tabs', tabs.length);

    tabs.forEach(tab => {
        log.log('-- tab ', tab);
        chrome.tabs.sendMessage(tab.id, { type: 'update' });
    });
  });
}

type SendResponse<T> = (response: T) => void;
type Sender = chrome.runtime.MessageSender;

function isOptionsPage(sender: Sender, method: string): boolean {
  if (optionsPageRegexp.test(sender.url)) {
    return true;
  }

  log.error(`A "${method}" message can only originate from the options page`);
  log.error('Not from %s', sender.url);

  return false;
}

type Catchable = string | Error;

function catchableToString(e: Catchable): string {
  if (typeof e === 'string') {
    return e;
  }

  return e && e.stack ? e.stack : String(e);
}

enum MessageListenerReply {
  WAIT_ON_ASYNC, DO_NOT_WAIT
};

import {
  GetManifestsRequest, GetManifestsReply,
  GetManifestErrorsRequest, GetManifestErrorsReply,
  AddManifestRequest, AddManifestReply,
  RemoveManifestRequest, RemoveManifestReply,
  RenameManifestRequest, RenameManifestReply,
  ChangeManifestOrderRequest, ChangeManifestOrderReply,
  ReloadDataRequest, ReloadDataReply,
  SetOptionsRequest, SetOptionsReply,
  GetOptionRequest, GetOptionReply,
  VerifyTokenRequest, VerifyTokenReply,
} from './options/communication';
import {
  HasPlayerRequest, HasPlayerReply,
  GetSourcesForExtraRequest, GetSourcesForExtraReply,
  GetPlayerRequest, GetPlayerReply,
  GetTranslationsWithPrefixRequest, GetTranslationsWithPrefixReply,
  SetExportDataRequest, SetExportDataReply,
  GetExportDataRequest, GetExportDataReply,
  FindRequest, FindReply,
  ShouldShowExportRequest, ShouldShowExportReply,
} from './communication';

let exportData: ExportData = null;

const messageListeners = Object.freeze({
  getManifests(request: GetManifestsRequest, sender: Sender, sendResponse: SendResponse<GetManifestsReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'getManifests')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    if (storageCache.has('manifests')) {
      log.log('Requesting manifests, loaded from cache');
      sendResponse(storageCache.get('manifests') as GetManifestsReply);
      return MessageListenerReply.DO_NOT_WAIT;
    }

    log.log('Requesting manifests, loading from source');

    (async () => {
      const [ names, information ] = await Promise.all([
        getStoredData<{ [s: string]: string }>('manifest_names', {}),
        data.getInformation()
      ]) as [ { [s: string]: string; }, { [s: string]: ManifestInformation }];

      _.forEach(information, info => {
        if (_.has(names, info.key)) {
          info.name = names[info.key];
        } else {
          info.name = info.key;
        }
      });

      storageCache.set('manifests', information);

      log.log('Sending result to getManifests:', information);
      sendResponse(information);
    })();

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  getManifestErrors(request: GetManifestErrorsRequest, sender: Sender, sendResponse: SendResponse<GetManifestErrorsReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'getManifestErrors')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    (async () => {
      const errors = await data.getErrors();

      log.log('Sending manifest errors:', errors);
      sendResponse(errors);
    })();

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  addManifest(request: AddManifestRequest, sender: Sender, sendResponse: SendResponse<AddManifestReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'addManifest')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    disableUpdateListener = true;
    addManifestKey(request.key, request.name).then(async added => {
      if (!added) {
        disableUpdateListener = false;
        sendResponse({ status: 'duplicate' });
        return;
      }

      const status = await reloadData();
      disableUpdateListener = false;
      sendResponse({ status });
    })
    .catch((error: Catchable) => {
      sendResponse({ status: 'failed', error: catchableToString(error) });
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  removeManifest(request: RemoveManifestRequest, sender: Sender, sendResponse: SendResponse<RemoveManifestReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'removeManifest')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    disableUpdateListener = true;
    removeManifestKey(request.key).then(async removed => {
      if (!removed) {
        disableUpdateListener = false;
        sendResponse({ status: 'nonexistent' });
        return;
      }

      const status = await reloadData();
      disableUpdateListener = false;
      sendResponse({ status });
    })
    .catch((error: Catchable) => {
      sendResponse({ status: 'failed', error: catchableToString(error) });
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  renameManifest(request: RenameManifestRequest, sender: Sender, sendResponse: SendResponse<RenameManifestReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'renameManifest')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    disableUpdateListener = true;
    renameManifest(request.key, request.oldName, request.newName).then(success => {
      disableUpdateListener = false;
      sendResponse({ status: success ? 'success' : 'failed' });
    })
    .catch((error: Catchable) => {
      sendResponse({ status: 'failed', error: catchableToString(error) });
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  changeManifestOrder(request: ChangeManifestOrderRequest, sender: Sender, sendResponse: SendResponse<ChangeManifestOrderReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'changeManifestOrder')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    log.log('Requesting to change order from %s to %s', request.oldOrder, request.newOrder);
    changeManifestOrder(request.oldOrder, request.newOrder).then(status =>
      sendResponse({ status })
    ).catch(() => sendResponse({ status: 'failed' }));

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  reloadData(request: ReloadDataRequest, sender: Sender, sendResponse: SendResponse<ReloadDataReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'reloadData')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    (async () => {
      try {
        const status = await reloadData();
        storageCache.remove('manifests');
        sendResponse({ status });
      } catch (e) {
        log.error(e);
        sendResponse({ status: 'failed', error: catchableToString(e) })
      }
    })();

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  setOptions(request: SetOptionsRequest, sender: Sender, sendResponse: SendResponse<SetOptionsReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'setOptions')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    const options: { [s: string]: string|boolean } = {};
    const { options: sentOptions } = request;

    if (!_.isEmpty(sentOptions.match)) {
      _.forEach(sentOptions.match, (value, key) => {
        options[`option-match-${key}`] = value;
      });
    }

    if (!_.isEmpty(sentOptions.show)) {
      _.forEach(sentOptions.show, (value, key) => {
        options[`option-show-${key}`] = value;
      });
    }

    if (!_.has(options, 'own-oid')) {
      options['option-own-oid'] = sentOptions['own-oid'];
    }

    setStoredDatas(options).then(() => {
      data.clearCache();
      updateTabs();
      sendResponse({});
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  getOption<T extends boolean | string | number>(request: GetOptionRequest<T>, sender: Sender, sendResponse: SendResponse<GetOptionReply<T>>): MessageListenerReply {
    getStoredData<T>(`option-${request.option}`, request.defaultValue).then(result => {
      sendResponse({ value: result });
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  verifyToken(request: VerifyTokenRequest, sender: Sender, sendResponse: SendResponse<VerifyTokenReply>): MessageListenerReply {
    if (!isOptionsPage(sender, 'verifyToken')) {
      // silently die by not sending a response
      return MessageListenerReply.DO_NOT_WAIT;
    }

    (async () => {
      if (!request.refresh) {
        sendResponse({ valid: await tokenBearer.isAuthorized() });
        return;
      }

      try {
        log.log('Starting OAuth2 flow...');
        await tokenBearer.authorize();
        log.log('OAuth2 flow Finished');

        storageCache.remove('manifests');
        chrome.browserAction.setBadgeText({ text: '' });

        sendResponse({ valid: true });
      } catch (e) {
        log.error(e);
        sendResponse({ valid: false });
      }
    })();

    return MessageListenerReply.WAIT_ON_ASYNC;
  },


  hasPlayer(request: HasPlayerRequest, sender: Sender, sendResponse: SendResponse<HasPlayerReply>): MessageListenerReply {
    data.hasPlayer(request.oid).then(hasPlayer => {
      sendResponse({ result: hasPlayer });
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  getSourcesForExtra(request: GetSourcesForExtraRequest, sender: Sender, sendResponse: SendResponse<GetSourcesForExtraReply>): MessageListenerReply {
    (async () => {
      const show = await getStoredData<boolean>('option-show-sources', true);

      if (!show) {
        sendResponse({ result: [] });
        return;
      }

      sendResponse({ result: await data.getSourcesForExtra(request.tag, request.oid) });
    })();

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  getPlayer(request: GetPlayerRequest, sender: Sender, sendResponse: SendResponse<GetPlayerReply>): MessageListenerReply {
    async function doGetPlayer() {
      const player = await data.getPlayer(request.oid);

      if (player == null) {
        sendResponse({ status: 'not-found' });
        return;
      }

      if (player.anomaly.length) {
        const showAnomalies = await getStoredData<boolean>('option-show-anomalies', true);

        if (!showAnomalies) {
          player.anomaly.length = 0;
        }
      }

      sendResponse({ status: 'success', player });
    }

    async function checkForSelf() {
      if (_.has(request, 'extra') && request.extra.show_self) {
        await doGetPlayer();
        return;
      }

      const hideSelf = await getStoredData<boolean>('option-show-hide-self', false);

      if (!hideSelf) {
        await doGetPlayer();
        return;
      }

      // user wants to hide his/her own oid
      const ownOid = await getStoredData<string>('option-own-oid', '');

      if (ownOid === request.oid) {
        // this is the user him/herself
        sendResponse({ status: 'not-found' });
        return;
      }

      await doGetPlayer();
    }

    (async function () {
      if (!_.has(request, 'extra') || !request.extra.match) {
        await checkForSelf();
        return;
      }

      const doMatch = await getStoredData<boolean>(`option-match-${request.extra.match}`,  true);

      if (!doMatch) {
        sendResponse({ status: 'not-found' });
        return;
      }

      await checkForSelf();
    })();

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  getTranslationsWithPrefix(
      request: GetTranslationsWithPrefixRequest, sender: Sender,
      sendResponse: SendResponse<GetTranslationsWithPrefixReply>): MessageListenerReply {
    getPrefixedMessages(request.locale, request.prefix, messages => {
      sendResponse({ messages });
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  setExportData(request: SetExportDataRequest, sender: Sender, sendResponse: SendResponse<SetExportDataReply>): MessageListenerReply {
    exportData = request.data;

    sendResponse({});

    return MessageListenerReply.DO_NOT_WAIT;
  },

  getExportData(request: GetExportDataRequest, sender: Sender, sendResponse: SendResponse<GetExportDataReply>): MessageListenerReply {
    sendResponse(exportData);

    return MessageListenerReply.DO_NOT_WAIT;
  },

  find(request: FindRequest, sender: Sender, sendResponse: SendResponse<FindReply>): MessageListenerReply {
    data.findPlayers(request.pattern).then(players => {
      sendResponse(players);
    });

    return MessageListenerReply.WAIT_ON_ASYNC;
  },

  shouldShowExport(request: ShouldShowExportRequest, sender: Sender, sendResponse: SendResponse<ShouldShowExportReply>): MessageListenerReply {
    getStoredData<boolean>('option-show-export', true).then(show => {
      sendResponse({ value: show });
    })

    return MessageListenerReply.WAIT_ON_ASYNC;
  },
} as {
  [s: string]: (request: any, sender: Sender, sendResponse: SendResponse<any>) => MessageListenerReply;
});

import { Request, Reply } from './communication';
chrome.runtime.onMessage.addListener((request: Request<{ type: string; }>, sender: Sender, sendResponse: (reply: Reply<any>) => void) => {
  let reply: Reply<any> = null;

  if (sender.tab) {
    log.log('Got "%s" request from tab %s, url: %s', request.request.type, sender.tab.id, sender.url);
  } else {
    log.error('Got request from this background page?');
    // silently ignore
    return false;
  }

  if (!_.has(messageListeners, request.request.type)) {
    log.error('Unknown message type:', request.request.type)
    log.error('Request:', request.request);
    log.error('Sender:', sender);

    // we're not sending a reply
    return false;
  }

  const shouldWait = messageListeners[request.request.type](request.request, sender, (reply) => {
    sendResponse({
      reply,
      shouldUpdate: data.shouldUpdateRemote(request.lastUpdate),
    });
  });

  return shouldWait === MessageListenerReply.WAIT_ON_ASYNC;
});

chrome.browserAction.onClicked.addListener(tab => {
  chrome.tabs.create({
      url: optionsPage,
      active: true,
      openerTabId: tab.id,
  });
});

function onUnauthorized() {
  storageCache.remove('manifests');

  chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000' });
  chrome.browserAction.setBadgeText({ text: '!' });

  chrome.tabs.query({}, tabs => {
    log.log('Sending "unauthorized" message to %d tabs', tabs.length);

    tabs.forEach(tab => {
        log.log('-- tab ', tab);
        chrome.tabs.sendMessage(tab.id, { type: 'unauthorized' });
    });
  });
}

tokenBearer.onInvalidToken(onUnauthorized);

// Load the data!
tokenBearer.ready().then(() => {
  if (!tokenBearer.isAuthorized()) {
    onUnauthorized();
    return;
  }

  reloadData();
});

setInterval(async () => {
  const updated = await data.update();

  if (updated) {
    storageCache.remove('manifests');
    updateTabs();
  }
}, 60 * 60 * 1000 /* one hour */);