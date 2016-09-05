/**
 * Merges player data.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Player, CommunityOrEvent, AnomalyName } from 'ingress-identity';
import _ from 'lodash';
import { anomalies as allAnomalies } from './util';
import * as log from '../log';

function mergeFaction(destination: Player, source: Player) {
  if (destination.faction === source.faction || source.faction === 'unknown') {
    return;
  }

  if (destination.faction === 'error' || source.faction === 'error') {
    destination.faction = 'error';
    return;
  }

  if (destination.faction !== 'unknown') {
    destination.errors.push(`Player defined as belonging to two factions: "${destination.faction}" and "${source.faction}"`);
    destination.faction = 'error';
    return;
  }

  destination.faction = source.faction;
}

function mergeLevel(destination: Player, source: Player) {
  if (destination.level < source.level) {
    destination.level = source.level;
  }
}

function mergeNickname(destination: Player, source: Player) {
  if (_.has(source, 'nickname')) {
    destination.nickname = source.nickname;
  }
}

function mergeName(destination: Player, source: Player) {
  if (_.has(source, 'name')) {
    destination.name = source.name;
  }
}

function mergeAnomaly(destination: AnomalyName[], source: AnomalyName[]) {
  source.forEach(entry => {
    if (!destination.includes(entry)) {
      destination.push(entry);
    }
  });
}

function mergeCommunityOrEvent(destination: CommunityOrEvent[], source: CommunityOrEvent[]) {
  source.push(...source); 
}

function mergeExtra(destination: Player, source: Player) {
  if (_.isEmpty(source.extra)) {
    return;
  }

  if (_.isEmpty(destination.extra)) {
    destination.extra = _.cloneDeep(source.extra);
    return;
  }

  _.forEach(source.extra, (value, key) => {
    if (destination.extra[key] && (typeof value === 'boolean') !== (typeof destination.extra[key] !== 'boolean')) {
      destination.errors.push(`Extra value "${key}" contains both boolean and string values`);
      return;
    }

    if (typeof value === 'boolean') {
      destination.extra[key] = (destination.extra[key] as boolean) || value; 
      return;
    }

    if (destination.extra[key]) {
      (destination.extra[key] as string[]).push(...value);
    } else {
      destination.extra[key] = [...value];
    }
  });
}

function mergeSources(destination: Player, source: Player) {
  destination.sources.push(...source.sources);
}

function mergeErrors(destination: Player, source: Player) {
  destination.errors.push(...source.errors);
}

function mergePlayers(destination: Player, ...players: Player[]): Player {
  if (!players.length) {
    return destination;
  }

  const source = players.shift();

  mergeFaction(destination, source);
  mergeLevel(destination, source);

  mergeNickname(destination, source);
  mergeName(destination, source);

  mergeAnomaly(destination.anomaly, source.anomaly);
  mergeCommunityOrEvent(destination.community, source.community);
  mergeCommunityOrEvent(destination.event, source.event);

  mergeExtra(destination, source);

  mergeSources(destination, source);
  mergeErrors(destination, source);

  return mergePlayers(destination, ...players);
}

export default function (...players: Player[]): Player {
  if (players.length < 1) {
    return players[0];
  }

  log.log('Merging players', players);

  const player = _.cloneDeep(players[0]);
  const merged = mergePlayers(player, ...players.slice(1));

  merged.anomaly = allAnomalies.filter(anomaly => merged.anomaly.includes(anomaly));

  log.log('Got merge result', merged);

  return merged;
}