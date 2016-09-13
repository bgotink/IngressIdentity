/*
 * Performs communication with the background page.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Settings, ExportData, Status, Player, SourceInformation, SearchPattern } from 'ingress-identity';
import { error as logError } from './log';

export type OnUpdateFunction = () => void;

let onUpdate: OnUpdateFunction = () => {};
let lastUpdate = Date.now();

export function setOnUpdate(ou: OnUpdateFunction): void {
  onUpdate = ou;
}

export interface Callback<T> {
  (result: T): void;
};

export interface Request<T extends { type: string; }> {
  lastUpdate: number;
  request: T;
}

export interface Reply<T> {
  reply: T;
  shouldUpdate?: boolean;
};

export function send<RequestType extends { type: string; }, ReplyType>(req: RequestType, callback?: Callback<ReplyType>): void {
  const request: Request<RequestType> = {
    request: req,
    lastUpdate: lastUpdate
  };
  lastUpdate = Date.now();

  try {
    chrome.runtime.sendMessage(request, (reply: Reply<ReplyType>) => {
      if (!reply) {
        logError('Got empty response to', request);
        if (chrome.runtime.lastError) {
          logError('Chrome error:', chrome.runtime.lastError);
        }
        return;
      }

      if (callback) {
        callback(reply.reply);
      }

      lastUpdate = Date.now();
      if (reply.shouldUpdate) {
        if (onUpdate) {
          onUpdate();
        }
      }
    });
  } catch (e) {
    // couldn't contact the extension
    // that can only mean one thing: extension has been reloaded, disabled or removed
    // -> reload the page
    document.location.reload();
  }
}

interface ReceivedRequest {
  type: string;
}

type MessageHandler = (request: any) => boolean;

const messageHandlers = {} as { [s: string]: MessageHandler };

export function addMessageListener(messageType: string, handler: MessageHandler) {
  if (messageHandlers[messageType]) {
    throw new Error(`Message handler ${messageType} already registered`);
  }

  messageHandlers[messageType] = handler;
}

chrome.runtime.onMessage.addListener((request?: ReceivedRequest) => {
  // ignore null
  if (!request) {
    return undefined;
  }

  if (request.type && messageHandlers[request.type]) {
    return messageHandlers[request.type](request);
  }

  // ignore: the options page gets all the messages meant for the background
  // page as well... logging/throwing here would fill the console with junk

  return false;
});

addMessageListener('update', () => {
  lastUpdate = Date.now();

  if (onUpdate) {
    onUpdate();
  }

  return false;
});

export interface HasPlayerRequest {
  type: 'hasPlayer';
  oid: string;
}

export interface HasPlayerReply {
  result: boolean;
}

export function hasPlayer(oid: string, callback: Callback<boolean>) {
  send<HasPlayerRequest, HasPlayerReply>({ type: 'hasPlayer', oid }, ({ result }) => callback(result));
}

interface GetPlayerRequestExtra {
  match?: string;
  show_self?: boolean;
}

export interface GetPlayerRequest {
  type: 'getPlayer';
  oid: string;
  extra?: GetPlayerRequestExtra;
};

export interface GetPlayerReply {
  status: Status;
  player?: Player;
}

export function getPlayer(oid: string, callback: (status?: Status, player?: Player) => void, extra?: GetPlayerRequestExtra) {
  const request: GetPlayerRequest = { type: 'getPlayer', oid };

  if (extra) {
    request.extra = extra;
  }

  send<GetPlayerRequest, GetPlayerReply>(request, ({ status, player }) => {
    if (status !== 'success') {
      return callback(status, null);
    }

    callback(null, player);
  });
}

export interface GetSourcesForExtraRequest {
  type: 'getSourcesForExtra';
  tag: string;
  oid: string;
};

export interface GetSourcesForExtraReply {
  result: SourceInformation[];
};

export function getSourcesForExtra(tag: string, oid: string, callback: Callback<SourceInformation[]>) {
  send<GetSourcesForExtraRequest, GetSourcesForExtraReply>({ type: 'getSourcesForExtra', tag, oid }, ({ result }) => callback(result));
}

export interface GetTranslationsWithPrefixRequest {
  type: 'getTranslationsWithPrefix';
  prefix: string;
  locale: string;
};

export interface GetTranslationsWithPrefixReply {
  messages: { [s: string]: string; };
}

export function getTranslationsWithPrefix(locale: string, prefix: string, callback: Callback<{ [s: string]: string; }>) {
  send<GetTranslationsWithPrefixRequest, GetTranslationsWithPrefixReply>({ type: 'getTranslationsWithPrefix', prefix, locale }, ({ messages }) => callback(messages));
}

export interface SetExportDataRequest {
  type: 'setExportData';
  data: ExportData;
};

export interface SetExportDataReply {};

export function setExportData(data: ExportData, callback: Callback<void>) {
  send<SetExportDataRequest, SetExportDataReply>({ type: 'setExportData', data }, () => callback(undefined));
};

export interface GetExportDataRequest {
  type: 'getExportData';
};

export type GetExportDataReply = ExportData;

export function getExportData(callback: Callback<ExportData>) {
  send<GetExportDataRequest, GetExportDataReply>({ type: 'getExportData' }, callback);
};

export interface ShouldShowExportRequest {
  type: 'shouldShowExport';
};

export interface ShouldShowExportReply {
  value: boolean;
}

export function shouldShowExport(callback: Callback<boolean>) {
  send<ShouldShowExportRequest, ShouldShowExportReply>({ type: 'shouldShowExport' }, ({ value }) => callback(value));
}

export interface FindRequest {
  type: 'find';
  pattern: SearchPattern;
};
export type FindReply = Player[];

export function find(pattern: SearchPattern, callback: Callback<Player[]>) {
  send<FindRequest, FindReply>({ type: 'find', pattern }, callback);
}
