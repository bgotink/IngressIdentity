/**
 * This file exports two classes to window.iidentity.spreadsheets in order to
 * facilitate loading the two kinds of spreadsheets this extension uses.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Faction, Level } from 'ingress-identity';

import _ from 'lodash';
import * as log from '../log';

import { parseLevel, parseFaction, isValidFaction } from './util';
import TokenBearer from './token';

// helper functions and classes

export interface FileData {
  index: number;
  sheetId: number;
  title: string;

  sheetType: 'GRID';

  gridProperties: {
    columnCount: number;
    rowCount: number;
  }
};

type StringData = { [s: string]: string };
type NestedStringData = { [s: string]: string|NestedStringData };

function removeEmptyProperties<T extends StringData|NestedStringData>(data: T): T|null {
  _.forEach(data, (value, key) => {
    if (typeof value === 'string') {
      if (value == null || !value.trim().length) {
        delete data[key];
      }
    } else {
      value = removeEmptyProperties(value as NestedStringData);

      if (value == null) {
        delete data[key];
      }
    }
  });

  if (_.isEmpty(data)) {
    return null;
  }

  return data;
}

/**
 * This class loads google drive documents.
 *
 * Before using this class, the google visualization library has to be loaded.
 */
export class File {
  private data: Promise<FileData[]>;
  // The constructor. The only parameter is the key/id of the spreadsheet.
  constructor(private tokenBearer: TokenBearer, private key: string) {
    this.reload();
  }

  public getKey() {
    return this.key;
  }

  /**
   * Loads the raw document. The callbackfunction should be of the type
   *   function (err, data) {}
   * err  will be non-null if an error or warning occured.
   * data will be null only if an error occured, otherwise it will be an
   *      array containing the tuples in the spreadsheet
   */
  public reload() {
    /*
     * fetch(
     *   'https://sheets.googleapis.com/v4/spreadsheets/1jwKDML130kLEzNvKqotxp00oHo55qMZCw_qSnjBnwcw',
     *   { headers: { 'Authorization': 'Bearer ya29.CjBSA7w75_GgnCXDeSsSld7IM5aNSnrxl5TPR2p8Y8VQDUCQHeka7lCo2kgtJPzFcYc' } }
     * ).then(res => console.log(res), err => console.error(err))
     */

    return this.data = this.tokenBearer.fetchAuthenticated(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.key}`
    )
    .then(response => response.json())
    .then(response => response.sheets.map(
      ({ properties }: { properties: FileData; }) => properties
    ));
  }

  public getData(oid: number): Promise<FileData|null> {
    return this.data.then(dataList => {
      return dataList.find(({ sheetId }) => sheetId === oid);
    });
  }

  public getUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.key}`;
  }
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
function numberToColumnId(nb: number): string {
  if (nb < ALPHABET.length) {
    return ALPHABET.charAt(nb);
  }

  return `${numberToColumnId(nb / ALPHABET.length)}${ALPHABET.charAt(nb % ALPHABET.length)}`;
}

interface RawSpreadsheetData {
  values: string[][];
}

type SpreadSheetEntry = { [s: string]: string };

export abstract class Spreadsheet<T> {
  private data: Promise<T[]>;
  protected err: string[];

  constructor(private key: string, private tokenBearer: TokenBearer, protected file: File, protected fileData: FileData) {
    this.reload();
  }

  public getKey(): string {
    return this.key;
  }

  private parseData(rawData: RawSpreadsheetData): SpreadSheetEntry[] {
    const header = rawData.values.splice(0, 1)[0].map(str => str.toLowerCase());

    return rawData.values.map(entry => {
      let obj: SpreadSheetEntry = {};

      header.forEach((key, idx) => {
        obj[header[idx]] = entry[idx];
      });

      return obj;
    })
    .map(removeEmptyProperties)
    .filter(data => !!data);
  }

  public getUid() {
    return `${this.file.getKey()}#gid=${this.fileData.sheetId}`;
  }

  private getNewFileData() {
    return this.file.getData(this.fileData.sheetId);
  }

  protected abstract validate(data: SpreadSheetEntry, i: number): T|null;

  public reload(): Promise<T[]> {
    this.err = [];
    return this.getNewFileData()
      .then(fileData => {
        const fileKey = this.file.getKey();
        if (fileData == null) {
          return Promise.reject(`No sheet with id "${this.fileData.sheetId}" found in "${fileKey}"`);
        }

        this.fileData = fileData;

        return this.tokenBearer.fetchAuthenticated(
          `https://sheets.googleapis.com/v4/spreadsheets/${fileKey}/values/A1:${numberToColumnId(fileData.gridProperties.columnCount)}${fileData.gridProperties.rowCount}?majorDimension=rows`
        )
        .then(response => response.json())
        .then((response: RawSpreadsheetData) => this.parseData(response))
        .then(response => (
          response.map((entry, i) => this.validate(entry, i))
            .filter(entry => !!entry)
        ));
      });
  }

  public getData() {
    return this.data;
  }

  public getUrl() {
    return `${this.file.getUrl()}#gid=${this.fileData.sheetId}`;
  }

  public getErrors(): string[] {
    return this.err;
  }

  public exists(): Promise<boolean> {
    return this.file.getData(this.fileData.sheetId)
      .then(found => !!found);
  }

  public getNumberOfRows() {
    return this.fileData.gridProperties.rowCount;
  }

  public getFile() {
    return this.file;
  }
}

export type ExtraData = { [s: string]: string };

export interface ManifestEntry {
  key: string;
  refresh: number;

  tag: string;
  faction: Faction;
  lastupdated: string;

  extraData?: ExtraData;

  errors: string[];
}

type RegularManifestKey = 'key' | 'refresh' | 'tag' | 'faction' | 'lastupdated';
export class ManifestSpreadsheet extends Spreadsheet<ManifestEntry> {
  protected validate(data: SpreadSheetEntry, i: number): ManifestEntry | null {
    let {
      key, refresh, tag, faction, lastupdated
    } = data;

    if (_.isEmpty(key)) {
      this.err.push(`No "key" present on line ${i}, skipping line`);
      return null;
    }

    if (key.match(/^9+$/)) {
      // Dummy entry, skip
      return null;
    }

    const errors: string[] = [];

    if (_.isEmpty(lastupdated)) {
      errors.push(`No "lastupdated" on line ${i}, skipping line`);
      return null;
    }

    if (_.isEmpty(tag)) {
      errors.push(`No "tag" set for "${key}" (line ${i}), using key as tag`);
      tag = key;
    }

    if (_.isEmpty(refresh)) {
      errors.push(`No "refresh" set for "${key}" (line ${i}), using "1"`);
      refresh = '1';
    }

    if (faction != null && !isValidFaction(faction)) {
      errors.push(`Invalid faction "${faction}" for "${key}" (line ${i})`);
    }

    const result: ManifestEntry = {
      key, lastupdated, tag,
      refresh: +refresh,
      faction: parseFaction(faction),
      errors
    };

    let extra = _.omit<ExtraData, SpreadSheetEntry>(data, 'key', 'refresh', 'tag', 'faction', 'lastupdated', 'extratags')

    if (_.has(data, 'extratags')) {
      if (!_.isEmpty(extra)) {
        errors.push('Using old-type extratags combined with extra columns is discouraged.');
      }

      extra = _.merge(data['extratags'], extra);
    }

    if (!_.isEmpty(extra)) {
      result.extraData = extra;
    }

    return result;
  }
}

export interface SourceEntry {
  oid: string;

  name?: string;
  nickname?: string;
  level: Level;

  extraData?: ExtraData;

  errors: string[]
}

export class SourceSpreadsheet extends Spreadsheet<SourceEntry> {
  protected validate(data: SpreadSheetEntry, i: number): SourceEntry {
    let {
      oid, name, nickname, level: levelStr
    } = data;

    if (_.isEmpty(oid)) {
      this.err.push(`OID missing at line ${i}`);
      return null;
    }

    if (oid.match(/^9+$/)) {
      // Dummy entry, skip
      return null;
    }

    const result: SourceEntry = {
      oid, name, nickname,
      level: parseLevel(levelStr),
      errors: [],
    };
    const extra = _.omit<ExtraData, SpreadSheetEntry>(data, 'oid', 'name', 'nickname', 'level');

    if (!_.isEmpty(extra)) {
      result.extraData = extra;
    }

    return result;
  }

  public async getNumberOfEntries(): Promise<number> {
    return (await this.getData()).length;
  }
}
