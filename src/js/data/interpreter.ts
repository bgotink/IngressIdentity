/**
 * Interpret manifests and sources.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import _ from 'lodash';
import { Player, Level, CommunityOrEvent, AnomalyName, PlayerExtra } from 'ingress-identity';
import { ManifestEntry, SourceEntry, ExtraData } from './spreadsheets';
import { parseFaction, isValidAnomaly, parseAnomaly } from './util';

function extractCommunityOrEvent(key: 'community' | 'event', data: ExtraData): CommunityOrEvent|null {
  if (!_.has(data, key)) {
    return null;
  }

  let oid = data[key].trim();
  delete data[key];
  
  let name: string;
  if (_.has(data, `${key}_name`)) {
    name = data[`${key}_name`];
    delete data[`${key}_name`];
  } else {
    let idx = oid.indexOf(':');
    
    if (idx === -1) {
      name = oid;
    } else {
      name = oid.slice(idx).trim();
      oid = oid.slice(0, idx).trim();
    }
  }

  const result: CommunityOrEvent = { oid, name };

  if (_.has(data, `${key}_image`)) {
    result.image = data[`${key}_image`];
    delete data[`${key}_image`];
  }

  return result;
}

function mapExtra(extra: ExtraData): PlayerExtra {
  const result = {} as PlayerExtra;

  _.forEach(extra, (value, key) => {
    if (value === 'true' || value === 'false') {
      result[key] = value === 'true';
    } else {
      result[key] = [ value ];
    }
  });

  return result;
}

export default function createPlayer(manifestEntry: ManifestEntry, sourceEntry: SourceEntry): Player {
  let {
    faction, extraData
  } = manifestEntry;

  let {
    oid,

    name,
    nickname,
    level,
    errors,

    extraData: sourceExtraData
  } = sourceEntry;

  const player: Player = {
    oid,
    faction,
    level,

    nickname,
    name,

    anomaly: [],
    community: [],
    event: [],

    sources: [],

    errors,
  };

  if (_.has(sourceExtraData, 'faction')) {
    player.faction = parseFaction(sourceExtraData['faction']);
    sourceExtraData = _.omit<ExtraData, ExtraData>(sourceExtraData, 'faction');
  }

  let extra = _.merge({} as ExtraData, extraData, sourceExtraData);

  const community = extractCommunityOrEvent('community', extra);
  if (community != null) {
    player.community.push(community);
  }

  const event = extractCommunityOrEvent('event', extra);
  if (event != null) {
    player.event.push(event);
  }

  if (_.has(extra, 'anomaly')) {
    if (isValidAnomaly(extra['anomaly'])) {
      player.anomaly.push(parseAnomaly(extra['anomaly']));
    } else {
      player.errors.push(`Unknown anomaly: "${extra['anomaly']}"`);
    }

    delete extra['anomaly'];
  }

  if (!_.isEmpty(extra)) {
    player.extra = mapExtra(extra);
  }
  
  return null;
}