/**
 * Player data manager
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

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
  private playerSource: Promise<RootSource>;

  constructor(private tokenBearer: TokenBearer, keys: string[]) {
    this.files = new Map();
    this.registeredManifests = new Map();

    this.playerSource = Promise.all(keys.map(key => this.createManifest(key)))
      .then(manifests => {
        keys.forEach(key => this.registeredManifests.set(key));

        return new RootSource(
          manifests,
          async (manifest: ManifestSpreadsheet, manifestEntry: ManifestEntry) => {
            return await this.createSource(
              manifest.getFile(),
              parseKey(manifestEntry.key).gid || 0
            )
          }
        )
      });
  }

  private async createManifest(key: string): Promise<ManifestSpreadsheet> {
    const parsedKey = parseKey(key);

    if (!parsedKey.gid) {
        parsedKey.gid = 0;
      }

    if (!this.files.has(parsedKey.key)) {
      this.files.set(parsedKey.key, new File(this.tokenBearer, parsedKey.key));
    }
    const file = this.files.get(parsedKey.key);

    const manifestData = await file.getData(parsedKey.gid);
    return new ManifestSpreadsheet(unparseKey(parsedKey), this.tokenBearer, file, manifestData);
  }

  private async createSource(file: File, gid: number): Promise<SourceSpreadsheet> {
    const fileData = await file.getData(gid);
    const key = parseKey(file.getKey());
    key.gid = gid;

    return new SourceSpreadsheet(unparseKey(key), this.tokenBearer, file, fileData);
  }

  public async addManifest(key: string) {
    if (this.registeredManifests.has(key)) {
      // Already added
      return Promise.resolve();
    }
    this.registeredManifests.set(key, null);

    return this.playerSource.then(playerSource => {
      return this.createManifest(key)
        .then(manifest => {
          if (!this.registeredManifests.has(key)) {
            // has been removed while loading
            return;
          }

          this.registeredManifests.set(key, manifest);
          playerSource.addManifest(manifest);
        });
    })
    .catch(err => {
      this.registeredManifests.delete(key);

      return Promise.reject(err);
    });
  }

  public async removeManifest(key: string) {
    if (!this.registeredManifests.has(key)) {
      // Not present
      return Promise.resolve();
    }
    const manifest = this.registeredManifests.get(key);
    this.registeredManifests.delete(key);

    if (manifest == null) {
      // Manifest was being added, so nothing more to do
      return Promise.resolve();
    }

    return this.playerSource.then(playerSource => {
      playerSource.removeManifest(manifest);
    });
  }

  public async ready() {
    await (await this.playerSource).ready();
  }

  public async reload() {
    await (await this.playerSource).reload();
  }

  public async getErrors(): Promise<{ [s: string]: ManifestErrors }> {
    return (await this.playerSource).getErrors();
  }

  public async getInformation() {
    return await (await this.playerSource).getInformation();
  }

  public async clearCache() {
    return (await this.playerSource).clearCache();
  }

  public async getPlayer(oid: string): Promise<Player> {
    return (await this.playerSource).getPlayer(oid);
  }

  public async hasPlayer(oid: string): Promise<boolean> {
    return (await this.playerSource).hasPlayer(oid);
  }

  public async findPlayers(pattern: SearchPattern): Promise<Player[]> {
    return (await this.playerSource).find(pattern);
  }

  public async getSourcesForExtra(type: string, oid: string): Promise<SourceInformation[]> {
    return (await this.playerSource).getSourcesForExtra(type, oid);
  }
}