/**
 * Player data manager
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import _ from 'lodash';
import { Player, SearchPattern, ManifestErrors, SourceInformation } from 'ingress-identity';
import { ManifestSpreadsheet, SourceSpreadsheet, File, ManifestEntry } from './spreadsheets';
import { RootSource } from './data';
import TokenBearer from './token';

interface ParsedKey {
  key: string;
  gid?: number;
}

function parseKey(key: string): ParsedKey {
  key = (key || '').trim();

  const matches = key.match(/(.*)[#&?]gid=(.*)/);
  if (matches) {
    return { key: matches[1], gid: +matches[2] };
  } else {
    return { key };
  }
}

function unparseKey(key: ParsedKey): string {
  if (key.gid != null) {
    return `${key.key}?gid=${key.gid}`;
  }

  return key.key;
}

function resolveKey(key: string, parent: ParsedKey, err?: string[]): ParsedKey|null {
  const data = parseKey(key);

  if (typeof data.key !== 'string' || !data.key.trim().length) {
    if (typeof parent.key !== 'string' || !parent.key.trim().length) {
      if (err) {
        err.push(`Cannot resolve key ${key} to parent ${parent}`);
      }

      return null;
    }

    data.key = parent.key;
  }

  return data;
}

export default class DataManager {
  private files: Map<string, File>;
  private registeredManifests: Map<string, ManifestSpreadsheet|null>;
  private playerSourcePromise: Promise<RootSource>;

  private playerSource: RootSource;

  constructor(private tokenBearer: TokenBearer, keys: string[]) {
    this.files = new Map();
    this.registeredManifests = new Map();

    this.playerSourcePromise = Promise.all(keys.map(key => this.createManifest(key)))
      .then(async manifests => {
        keys.forEach((key, i) => this.registeredManifests.set(key, manifests[i]));

        const rootSource =  new RootSource(
          manifests,
          async (manifest: ManifestSpreadsheet, manifestEntry: ManifestEntry) => {
            return await this.createSource(
              manifest.getFile(),
              manifestEntry.key
            )
          }
        );

        await rootSource.ready();

        return this.playerSource = rootSource;
      });
  }

  private async createManifest(key: string): Promise<ManifestSpreadsheet> {
    const parsedKey = parseKey(key);

    if (!parsedKey.gid) {
      parsedKey.gid = 0;
    }

    const file = this.getFile(parsedKey.key);

    return new ManifestSpreadsheet(key, this.tokenBearer, file, parsedKey.gid);
  }

  private getFile(key: string): File {
    if (!this.files.has(key)) {
      this.files.set(key, new File(this.tokenBearer, key));
    }
    return this.files.get(key);
  }

  private async createSource(file: File, key: string): Promise<SourceSpreadsheet> {
    const parsedKey = resolveKey(key, parseKey(file.getKey()));

    return new SourceSpreadsheet(key, this.tokenBearer, file, parsedKey.gid);
  }

  public async addManifest(key: string) {
    if (this.registeredManifests.has(key)) {
      // Already added
      return;
    }
    this.registeredManifests.set(key, null);

    try {
      const manifest = await this.createManifest(key);

      if (!this.registeredManifests.has(key)) {
        // removed while loading
        return;
      }

      this.registeredManifests.set(key, manifest);
      await this.playerSource.addManifest(manifest);
    } catch (e) {
      this.registeredManifests.delete(key);
      throw e;
    }
  }

  public removeManifest(key: string) {
    if (!this.registeredManifests.has(key)) {
      // Not present
      return;
    }
    const manifest = this.registeredManifests.get(key);
    this.registeredManifests.delete(key);

    if (manifest == null) {
      // Manifest was being added, so nothing more to do
      return;
    }

    this.playerSource.removeManifest(manifest);
  }

  public reorderManifests(keys: string[]) {
    this.playerSource.reorderManifests(keys);
  }

  public async ready() {
    await this.playerSourcePromise;
  }

  public async reload() {
    await this.playerSource.reload();
  }

  public getErrors(): { [s: string]: ManifestErrors } {
    return this.playerSource.getErrors();
  }

  public hasErrors(): boolean {
    const errors = this.getErrors();

    return _.some(errors, manifestErrors => {
      return _.some(manifestErrors, err => err.length > 0);
    });
  }

  public async getInformation() {
    return await this.playerSource.getInformation();
  }

  public clearCache() {
    this.playerSource.clearCache();
  }

  public async getPlayer(oid: string): Promise<Player> {
    return this.playerSource.getPlayer(oid);
  }

  public async hasPlayer(oid: string): Promise<boolean> {
    return this.playerSource.hasPlayer(oid);
  }

  public async findPlayers(pattern: SearchPattern): Promise<Player[]> {
    return this.playerSource.find(pattern);
  }

  public async getSourcesForExtra(type: string, oid: string): Promise<SourceInformation[]> {
    return this.playerSource.getSourcesForExtra(type, oid);
  }

  public async update(): Promise<boolean> {
    return this.playerSource.update();
  }

  public shouldUpdateRemote(remoteTimestamp: number): boolean {
    return this.playerSource.shouldUpdateRemote(remoteTimestamp);
  }
}