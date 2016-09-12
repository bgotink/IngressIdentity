/**
 * Interpret, cache and merge player data.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Player, SearchPattern, ManifestInformationEntry, ManifestInformation, ManifestErrors, SourceInformation } from 'ingress-identity';

import { File, ManifestSpreadsheet, ManifestEntry, SourceSpreadsheet, SourceEntry } from './spreadsheets';
import createPlayer from './interpreter';
import mergePlayers from './merger';
import { createStandardPlayerFinder, createPlayerFinder, FindFunction } from './finder';
import { somePromise } from './util';

import * as log from '../log';

type PlayerMap = Map<string, Player>;

interface HasPlayers {
  getPlayer(oid: string): Promise<Player|null>;
  hasPlayer(oid: string): Promise<boolean>;
  findOids(pattern: FindFunction): Promise<string[]>;
  shouldUpdateRemote(remoteTimestamp: number): boolean;
};

class PlayerSource implements HasPlayers {
  private err: string[];
  private timestamp: number;
  private players: Promise<PlayerMap>;

  constructor(private metadata: ManifestEntry, private spreadsheet: SourceSpreadsheet) {
    this.err = spreadsheet.getErrors();
    this.markUpdated();

    this.players = this.parsePlayers();
  }

  public async exists() {
    return this.spreadsheet.exists();
  }

  public getUrl() {
    return this.spreadsheet.getUrl();
  }

  public getTag() {
    return this.metadata.tag;
  }

  public async reload(metadata: ManifestEntry) {
    this.metadata = metadata;

    await this.spreadsheet.reload();
    this.players = this.parsePlayers();
  }

  public shouldUpdate(): boolean {
    return Date.now() > this.timestamp + (this.metadata.refresh * 60 * 60 * 1000);
  }

  public shouldUpdateRemote(remoteTimestamp: number): boolean {
    return remoteTimestamp < this.timestamp;
  }

  public markUpdated() {
    this.timestamp = Date.now();
  }

  private async parsePlayers() {
    const sourceData = await this.spreadsheet.getData();
    const players = sourceData.map(entry => createPlayer(this.metadata, entry));

    return players.reduce((map, player) => {
        player.sources.push(this.getSourceInformation());

        map.set(player.oid, player);

        return map;
      }, new Map<string, Player>());
  }

  public getNumberOfPlayers() {
    return this.spreadsheet.getNumberOfRows();
  }

  public async getPlayer(oid: string): Promise<Player|null> {
    const players = await this.players;
    return players.get(oid) || null;
  }

  public async hasPlayer(oid: string): Promise<boolean> {
    return (await this.players).has(oid);
  }

  public async getPlayers(): Promise<Player[]> {
    return [...(await this.players).values()];
  }

  public async findOids(pattern: FindFunction): Promise<string[]> {
    let players = (await this.getPlayers()).filter(pattern);

    return players.map(player => player.oid);
  }

  public async ready(): Promise<void> {
    await Promise.all([ this.spreadsheet.ready(), this.players ]);
  }

  public getErrors() {
    return this.metadata.errors.concat(this.spreadsheet.getErrors());
  }

  public async getInformation(): Promise<ManifestInformationEntry> {
    return {
      key: this.spreadsheet.getKey(),
      url: this.spreadsheet.getUrl(),
      count: (await this.spreadsheet.getNumberOfRows()),
      tag: this.metadata.tag,
      version: this.metadata.lastupdated,
      faction: this.metadata.faction,
    };
  }

  public hasExtra(type: string, oid: string) {
    if (!this.metadata.extraData || !this.metadata.extraData[type]) {
      return false;
    }

    let value = this.metadata.extraData[type];
    const idx = value.indexOf(':');
    if (idx !== -1) {
      value = value.slice(0, idx);
    }

    return value.trim() === oid;
  }

  public getSourceInformation(): SourceInformation {
    return {
      url: this.getUrl(),
      tag: this.getTag(),
    };
  }
}

interface SourceFactory {
  (entry: ManifestEntry): Promise<PlayerSource>;
};

abstract class CombinedPlayerSource<T extends HasPlayers> implements HasPlayers {
  protected sources: Map<string, T>;
  protected playerCache: Map<string, Promise<Player>>;

  constructor() {
    this.sources = new Map();
    this.playerCache = new Map();
  }

  private async createPlayer(oid: string): Promise<Player|null> {
    const unmergedData: Promise<Player>[] = [];

    for (let source of this.sources.values()) {
      unmergedData.push(source.getPlayer(oid));
    }

    return mergePlayers(
      ... (await Promise.all(unmergedData)).filter(player => player != null)
    );
  }

  public async getPlayer(oid: string): Promise<Player|null> {
    if (this.playerCache.has(oid)) {
      return this.playerCache.get(oid);
    }

    const result = this.createPlayer(oid);
    this.playerCache.set(oid, result);

    return result;
  }

  public async hasPlayer(oid: string): Promise<boolean> {
    if (this.playerCache.has(oid)) {
      return true;
    }

    return somePromise([ ...this.sources.values() ].map(source => source.hasPlayer(oid)));
  }

  public async findOids(pattern: FindFunction): Promise<string[]> {
    const foundPlayers = await Promise.all(
      [...this.sources.values()].map(source => source.findOids(pattern))
    );

    const result = new Set<string>();

    foundPlayers.forEach(l => {
      l.forEach(oid => {
        result.add(oid);
      });
    });

    return [...result];
  }

  public clearCache() {
    this.playerCache.clear();
  }

  public shouldUpdateRemote(remoteTimestamp: number): boolean {
    for (let source of this.sources.values()) {
      if (source.shouldUpdateRemote(remoteTimestamp)) {
        return true;
      }
    }

    return false;
  }
}

class ManifestSource extends CombinedPlayerSource<PlayerSource> {
  private readyPromise: Promise<void>;

  constructor(private spreadsheet: ManifestSpreadsheet, private sourceFactory: SourceFactory) {
    super();

    this.readyPromise = (async () => {
      const manifestData = await spreadsheet.getData();

      await Promise.all(
        manifestData.map(async manifestEntry => {
          const newSource = await this.sourceFactory(manifestEntry);
          this.sources.set(manifestEntry.key, newSource);
          await newSource.ready();
        })
      );
    })();
  }

  public async ready() {
    await this.readyPromise;
  }

  public async reload() {
    await (this.readyPromise = this.doReload());
  }

  private async doReload() {
    const manifestData = await this.spreadsheet.reload();
    const removedKeys = new Set(this.sources.keys());

    const promises = manifestData.map(async (manifestEntry) => {
        if (this.sources.has(manifestEntry.key)) {
          removedKeys.delete(manifestEntry.key);
          await this.sources.get(manifestEntry.key).reload(manifestEntry);
          return;
        }

        const newSource = await this.sourceFactory(manifestEntry);
        this.sources.set(manifestEntry.key, newSource);

        await newSource.ready();
    });

    await Promise.all(promises);

    for (let key in removedKeys) {
      this.sources.delete(key);
    }
    this.clearCache();
  }

  public async update(): Promise<boolean> {
    let updated = false;

    const manifestData = await this.spreadsheet.reload();
    const removedKeys = new Set(this.sources.keys());

    const promises = manifestData.map(async (manifestEntry) => {
        if (this.sources.has(manifestEntry.key)) {
          removedKeys.delete(manifestEntry.key);

          const source = this.sources.get(manifestEntry.key);
          if (source.shouldUpdate()) { 
            await source.reload(manifestEntry);
            source.markUpdated();
            updated = true;
          }
          return;
        }

        const newSource = await this.sourceFactory(manifestEntry);
        this.sources.set(manifestEntry.key, newSource);

        await newSource.ready();
        updated = true;
    });

    await Promise.all(promises);

    if (removedKeys.size) {
      for (let key in removedKeys) {
        this.sources.delete(key);
      }
      updated = true;
    }

    if (!updated) {
      return false;
    }

    this.clearCache();
    return true;
  }

  public getErrors(): ManifestErrors {
    const result: ManifestErrors = {
      '.manifest': this.spreadsheet.getErrors()
    };

    for (let [ key, source ] of this.sources) {
      result[key] = source.getErrors();
    }

    return result;
  }

  public async getInformation(): Promise<ManifestInformation> {
    let informations = await Promise.all([... this.sources.entries()].map(
      async ([ key, source ]): Promise<ManifestInformationEntry> => await source.getInformation()
    ));

    return {
      key: this.spreadsheet.getKey(),
      url: this.spreadsheet.getUrl(),

      sources: informations.reduce((obj, information) => {
        obj[information.key] = information;
        return obj;
      }, {} as { [s: string]: ManifestInformationEntry })
    }
  }

  public getSourcesForExtra(type: string, oid: string): SourceInformation[] {
    return [ ...this.sources.values() ].filter(source => source.hasExtra(type, oid))
      .map(source => source.getSourceInformation());
  }
}

export type SourceSheetFactory = (manifest: ManifestSpreadsheet, manifestEntry: ManifestEntry) => Promise<SourceSpreadsheet>;

export class RootSource extends CombinedPlayerSource<ManifestSource> {
  constructor(manifests: ManifestSpreadsheet[], private sourceFactory: SourceSheetFactory) {
    super();

    manifests.forEach(manifest => this.doAddManifest(manifest));
  }

  public async find(pattern: SearchPattern): Promise<Player[]> {
    const finder = createPlayerFinder(pattern);
    const standardFinder = createStandardPlayerFinder(pattern);

    const oids = await this.findOids(standardFinder);
    const players = await Promise.all(oids.map(oid => this.getPlayer(oid)));

    return players.filter(finder);
  }

  public async ready() {
    await Promise.all(
      [...this.sources.values()].map(source => source.ready())
    );
  }

  public async reload() {
    await Promise.all(
      [...this.sources.values()].map(source => source.reload())
    );

    this.clearCache();
  }

  public async update(): Promise<boolean> {
    const updated = await Promise.all(
      [...this.sources.values()].map(source => source.update())
    );

    if (updated.every(u => !u)) {
      return false;
    }

    this.clearCache();
    return true;
  }

  public getErrors(): { [s: string]: ManifestErrors } {
    const result: { [s: string]: ManifestErrors } = {};

    for (let [ key, manifestSource ] of this.sources) {
      result[key] = manifestSource.getErrors();
    }

    return result;
  }

  private async doAddManifest(manifest: ManifestSpreadsheet) {
    const uid = manifest.getUid();

    if (this.sources.has(uid)) {
      // Already registered
      return false;
    }

    const manifestSource = new ManifestSource(manifest, (manifestEntry) => {
      return this.sourceFactory(manifest, manifestEntry)
        .then(sourceSheet => new PlayerSource(manifestEntry, sourceSheet))
    });

    await manifestSource.ready();

    this.sources.set(manifest.getUid(), manifestSource);
    return true;
  }

  public async addManifest(manifest: ManifestSpreadsheet) {
    if (await this.doAddManifest(manifest)) {
      this.clearCache();
    }
  }

  public removeManifest(manifest: ManifestSpreadsheet) {
    const uid = manifest.getUid();

    if (!this.sources.has(uid)) {
      // Not registered
      return;
    }

    this.sources.delete(uid);
    this.clearCache();
  }

  public async getInformation(): Promise<{ [s: string]: ManifestInformation }> {
    const informations = await Promise.all([...this.sources.entries()].map(
      async ([ key, source ]): Promise<ManifestInformation> =>
        await source.getInformation()
      )
    );

    return informations.reduce((obj, information) => {
      obj[information.key] = information;
      return obj;
    }, {} as { [s: string]: ManifestInformation });
  }

  public getSourcesForExtra(type: string, oid: string): SourceInformation[] {
    return [ ...this.sources.values() ].map(source => source.getSourcesForExtra(type, oid))
      .reduce((result, values) => {
        result.push(...values);
        return result;
      }, [] as SourceInformation[]);
  }
}