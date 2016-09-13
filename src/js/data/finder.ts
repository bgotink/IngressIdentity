/*
 * Interpret manifests and sources.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { Player, Faction, AnomalyName, SearchPattern } from 'ingress-identity';
import _ from 'lodash';

const standardPatternKeys = [ 'name', 'nickname' ];

function stringToRegExp(str: string) {
  const re: string[] = [];

  if (!str.startsWith('^')) {
    re.push('^');
  }

  re.push(...str.split(/\s+/));

  if (!str.endsWith('$')) {
    re.push('$');
  }

  return new RegExp(re.join('.*'), 'i');
}

export type FindFunction = (player: Player) => boolean;

// matches specific elements in player objects
const finderCreators = Object.freeze({
  name(pattern: string): FindFunction {
    const re = stringToRegExp(pattern);

    return player => _.has(player, 'name') && re.test(player.name);
  },
  nickname(pattern: string): FindFunction {
    const re = stringToRegExp(pattern);

    return player => _.has(player, 'nickname') && re.test(player.nickname);
  },
  faction(faction: Faction): FindFunction {
    return player => player.faction === faction;
  },

  anomaly(anomalies: AnomalyName[]): FindFunction {
    // The anomalies match if all defined anomalies are present.
    // Extra anomalies might exist, doesn't matter!

    switch(anomalies.length) {
      case 0: return () => true;
      case 1:
        const anomaly = anomalies[0];
        return player => player.anomaly.includes(anomaly);
      default:
        return player => {
          return anomalies.every(anomaly => player.anomaly.includes(anomaly));
        };
    }
  },
});

export function createPlayerFinder(pattern: SearchPattern): FindFunction {
  const finders: FindFunction[] = [];

  if (!_.isEmpty(pattern.name)) {
    finders.push(finderCreators.name(pattern.name));
  }

  if (!_.isEmpty(pattern.nickname)) {
    finders.push(finderCreators.nickname(pattern.nickname));
  }

  if (!_.isElement(pattern.faction)) {
    finders.push(finderCreators.faction(pattern.faction));
  }

  if (!_.isEmpty(pattern.anomaly)) {
    finders.push(finderCreators.anomaly(pattern.anomaly));
  }

  return (player: Player) => {
    return finders.every(finder => finder(player));
  }
}

export function createStandardPlayerFinder(pattern: SearchPattern): FindFunction {
  return createPlayerFinder(_.pick<SearchPattern, SearchPattern>(pattern, standardPatternKeys));
}
