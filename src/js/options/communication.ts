/*
 * Extends the communication functions for the options page
 * Note: must be loaded _after_ the base communications script.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Status, Settings, ManifestInformation, ManifestErrors } from 'ingress-identity';
import { send, Callback } from '../communication';

// just export all the existing communication functions
export * from '../communication';

export interface GetManifestsRequest {
  type: 'getManifests';
};

export interface GetManifestsReply {
  [s: string]: ManifestInformation;
}

export function getManifests(callback: Callback<GetManifestsReply>) {
  send<GetManifestsRequest, GetManifestsReply>({ type: 'getManifests' }, callback);
}

export interface GetManifestErrorsRequest {
  type: 'getManifestErrors';
};

export interface GetManifestErrorsReply {
  [s: string]: ManifestErrors;
}

export function getManifestErrors(callback: Callback<GetManifestErrorsReply>) {
  send<GetManifestErrorsRequest, GetManifestErrorsReply>({ type: 'getManifestErrors' }, callback);
}

interface HasStatus {
  status: Status;
};

export interface AddManifestRequest {
  type: 'addManifest';
  key: string;
  name?: string;
};

export interface AddManifestReply extends HasStatus {
  error?: string;
}

export function addManifest(key: string, name: string, callback: Callback<Status>) {
  send<AddManifestRequest, AddManifestReply>({ type: 'addManifest', key, name: (typeof name === 'string' ? name : '') }, ({ status }) => callback(status));
}

export interface RenameManifestRequest {
  type: 'renameManifest';
  key: string;
  oldName: string;
  newName: string;
};

export interface RenameManifestReply extends HasStatus {
  error?: string;
}

export function renameManifest(key: string, oldName: string, newName: string, callback: Callback<Status>) {
  send<RenameManifestRequest, RenameManifestReply>({ type: 'renameManifest', key, oldName, newName }, ({ status }) => callback(status));
}

export interface RemoveManifestRequest {
  type: 'removeManifest';
  key: string;
};

export interface RemoveManifestReply extends HasStatus {
  error?: string;
}

export function removeManifest(key: string, callback: Callback<Status>) {
  send<RemoveManifestRequest, RemoveManifestReply>({ type: 'removeManifest', key }, ({ status }) => callback(status));
}

export interface ChangeManifestOrderRequest {
  type: 'changeManifestOrder';
  oldOrder: string[];
  newOrder: string[];
};

export type ChangeManifestOrderReply = HasStatus;

export function changeManifestOrder(oldOrder: string[], newOrder: string[], callback: Callback<Status>) {
  send<ChangeManifestOrderRequest, ChangeManifestOrderReply>({ type: 'changeManifestOrder', oldOrder, newOrder }, ({ status }) => callback(status));
}

export interface ReloadDataRequest {
  type: 'reloadData';
};

export interface ReloadDataReply extends HasStatus {
  error?: string;
};

export function reloadData(callback: Callback<Status>) {
  send<ReloadDataRequest, ReloadDataReply>({ type: 'reloadData' }, ({ status }) => callback(status));
}

export interface SetOptionsRequest {
  type: 'setOptions';
  options: Settings;
};

export interface SetOptionsReply {};

export function setOptions(options: Settings, callback: Callback<void>) {
  send<SetOptionsRequest, SetOptionsReply>({ type: 'setOptions', options }, () => callback(undefined));
}

export interface GetOptionRequest<T extends string|number|boolean> {
  type: 'getOption';
  option: string;
  defaultValue: T;
};

export interface GetOptionReply<T extends string|number|boolean> {
  value: T;
};

export function getOption<T extends string|number|boolean>(option: string, defaultValue: T, callback: Callback<T>) {
  send<GetOptionRequest<T>, GetOptionReply<T>>({ type: 'getOption', option, defaultValue }, ({ value }) => callback(value));
}

export interface VerifyTokenRequest {
  type: 'verifyToken';
  refresh: boolean;
}

export interface VerifyTokenReply {
  valid: boolean;
}

export function verifyToken(refresh: boolean, callback: Callback<boolean>) {
  send<VerifyTokenRequest, VerifyTokenReply>({ type: 'verifyToken', refresh }, ({ valid }) => callback(valid));
}