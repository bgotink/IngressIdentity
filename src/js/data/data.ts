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

interface HasKey {
  getKey(): string;
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

  public getKey(): string {
    return this.spreadsheet.getKey();
  }

  public async getInformation(): Promise<ManifestInformationEntry> {
    return {
      key: this.getKey(),
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

abstract class CombinedPlayerSource<T extends HasPlayers & HasKey> implements HasPlayers {
  protected sources: T[];
  protected playerCache: Map<string, Promise<Player>>;

  constructor() {
    this.sources = [];
    this.playerCache = new Map();
  }

  protected getEntry(key: string): T {
    return this.sources.find(source => source.getKey() === key);
  }

  protected removeEntry(key: string): boolean {
    const idx = this.sources.findIndex(source => source.getKey() === key);

    if (idx === -1) {
      return false;
    }

    this.sources.splice(idx, 1);
    return true;
  }

  private async createPlayer(oid: string): Promise<Player|null> {
    const unmergedData = await Promise.all(this.sources.map(source => source.getPlayer(oid)));

    return mergePlayers(
      ... unmergedData.filter(player => player != null)
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

    return somePromise(this.sources.map(source => source.hasPlayer(oid)));
  }

  public async findOids(pattern: FindFunction): Promise<string[]> {
    const foundPlayers = await Promise.all(
      this.sources.map(source => source.findOids(pattern))
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
    return !this.sources.every(source => !source.shouldUpdateRemote(remoteTimestamp));
  }
}

class ManifestSource extends CombinedPlayerSource<PlayerSource> {
  private readyPromise: Promise<void>;

  constructor(private spreadsheet: ManifestSpreadsheet, private sourceFactory: SourceFactory) {
    super();

    this.readyPromise = (async () => {
      const manifestData = await spreadsheet.getData();

      this.sources = await Promise.all(manifestData.map(this.sourceFactory));

      await Promise.all(this.sources.map(async source => await source.ready()));
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
    let changed = false;

    const newSources = await Promise.all(manifestData.map(async (manifestEntry) => {
      let source = this.getEntry(manifestEntry.key);
      if (source) {
        await source.reload(manifestEntry);
        return source;
      }

      source = await this.sourceFactory(manifestEntry);

      await source.ready();

      changed = true;
      return source;
    }));

    if (newSources.length !== this.sources.length) {
      changed = true;
    } else if (!this.sources.every((existingSource, i) => existingSource.getKey() === newSources[i].getKey())) {
      changed = true;
    }

    if (changed) {
      this.sources = newSources;
      this.clearCache();
    }
  }

  public async update(): Promise<boolean> {
    let updated = false;

    const manifestData = await this.spreadsheet.reload();

    const newSources = await Promise.all(manifestData.map(async (manifestEntry) => {
      let source = this.getEntry(manifestEntry.key);
      if (source) {
        if (source.shouldUpdate()) {
          await source.reload(manifestEntry);
          source.markUpdated();
          updated = true;
        }
        return source;
      }

      source = await this.sourceFactory(manifestEntry);
      await source.ready();

      updated = true;
      return source;
    }));

    if (newSources.length !== this.sources.length) {
      updated = true;
    } else if (!this.sources.every((existingSource, i) => existingSource.getKey() === newSources[i].getKey())) {
      updated = true;
    }

    if (!updated) {
      return false;
    }

    this.sources = newSources;
    this.clearCache();
    return true;
  }

  public getErrors(): ManifestErrors {
    const result: ManifestErrors = {
      '.manifest': this.spreadsheet.getErrors()
    };

    this.sources.forEach(source =>
      result[source.getKey()] = source.getErrors()
    );

    return result;
  }

  public getKey(): string {
    return this.spreadsheet.getKey();
  }

  public async getInformation(): Promise<ManifestInformation> {
    let informations = await Promise.all(this.sources.map(
      async (source): Promise<ManifestInformationEntry> => await source.getInformation()
    ));

    return {
      key: this.getKey(),
      url: this.spreadsheet.getUrl(),

      sources: informations.reduce((obj, information) => {
        obj[information.key] = information;
        return obj;
      }, {} as { [s: string]: ManifestInformationEntry })
    }
  }

  public getSourcesForExtra(type: string, oid: string): SourceInformation[] {
    return this.sources.filter(source => source.hasExtra(type, oid))
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
      this.sources.map(source => source.ready())
    );
  }

  public async reload() {
    await Promise.all(
      this.sources.map(source => source.reload())
    );

    this.clearCache();
  }

  public async update(): Promise<boolean> {
    const updated = await Promise.all(
      this.sources.map(source => source.update())
    );

    if (updated.every(u => !u)) {
      return false;
    }

    this.clearCache();
    return true;
  }

  public getErrors(): { [s: string]: ManifestErrors } {
    return this.sources.reduce((obj, source) => {
      obj[source.getKey()] = source.getErrors();
      return obj;
    }, {} as { [s: string]: ManifestErrors });
  }

  private async doAddManifest(manifest: ManifestSpreadsheet) {
    const key = manifest.getKey();

    if (this.getEntry(key)) {
      // Already registered
      return false;
    }

    const manifestSource = new ManifestSource(manifest, (manifestEntry) => {
      return this.sourceFactory(manifest, manifestEntry)
        .then(sourceSheet => new PlayerSource(manifestEntry, sourceSheet))
    });

    await manifestSource.ready();

    this.sources.push(manifestSource);
    return true;
  }

  public async addManifest(manifest: ManifestSpreadsheet) {
    if (await this.doAddManifest(manifest)) {
      this.clearCache();
    }
  }

  public removeManifest(manifest: ManifestSpreadsheet) {
    const key = manifest.getKey();

    if (!this.removeEntry(key)) {
      // Not registered
      return;
    }

    this.clearCache();
  }

  public async getInformation(): Promise<{ [s: string]: ManifestInformation }> {
    const informations = await Promise.all(this.sources.map(
      async (source): Promise<ManifestInformation> =>
        await source.getInformation()
      )
    );

    return informations.reduce((obj, information) => {
      obj[information.key] = information;
      return obj;
    }, {} as { [s: string]: ManifestInformation });
  }

  public getSourcesForExtra(type: string, oid: string): SourceInformation[] {
    return this.sources.map(source => source.getSourcesForExtra(type, oid))
      .reduce((result, values) => {
        result.push(...values);
        return result;
      }, [] as SourceInformation[]);
  }
}