/**
 * Typings for IngressIdentity model
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

declare module 'ingress-identity' {
  type Faction = "enlightened" | "resistance" | "unknown" | "error";

  type AnomalyName = 
    '13magnus' |
    'recursion' |
    'interitus' |
    'initio' |
    'helios' |
    'darsana' |
    'shonin' |
    'persepolis' |
    'abaddon' |
    'obsidian' |
    'aegis_nova' |
    'via_lux';
  
  type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

  interface HasOid {
    oid: string;
  }

  interface CommunityOrEvent extends HasOid {
    name: string;
    image?: string;
  }

  type PlayerExtra = { [s: string]: string[]|boolean };

  interface SourceInformation {
    url: string;
    tag: string;
  }

  interface Player extends HasOid {
    faction: Faction;
    level: Level;
    
    nickname?: string;
    name?: string;

    anomaly: AnomalyName[];
    community: CommunityOrEvent[];
    event: CommunityOrEvent[];
    
    extra?: PlayerExtra;

    sources: SourceInformation[]

    errors?: string[];
  }

  interface Settings {
    match: {
      [s: string]: boolean;
    };
    show: {
      [s: string]: boolean;
    };
    'own-oid': string;
  }

  interface ManifestMetaData {
    key: string;
    name?: string;
    url?: string;

    sources: SourceMetaData[];
  }

  interface SourceMetaData {
    key: string;
    version: number;

    faction: Faction;
    tag: string;
    url: string;

    players: number;
  }

  interface ExportDataEntry {
      oid: string;
      name: string;
      nickname?: string;
  }

  interface ExportData {
    oid?: string;
    showWarning?: boolean;

    name?: string;
    entries?: ExportDataEntry[];
  }

  interface SearchPattern {
    name?: string;
    nickname?: string;
    faction?: Faction;
    anomaly?: AnomalyName[];
  }

  type  Status = 'success' | 'warning' | 'failed' | 'duplicate' | 'nonexistent' | 'not-found';

  interface ManifestInformationEntry {
    key: string;
    tag: string;
    count: number;
    version: string;
    faction: Faction;

    url?: string;
  }

  interface ManifestInformation {
    key: string;
    sources: { [s: string]: ManifestInformationEntry };
    
    name?: string;
    url?: string;
  }

  interface ManifestErrors {
    '.manifest': string[];
    [s: string]: string[];
  }
}
