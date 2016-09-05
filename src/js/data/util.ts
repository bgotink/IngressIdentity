/**
 * Utility functions
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import _ from 'lodash';
import { Player, Level, Faction, AnomalyName } from 'ingress-identity';

export const anomalies = Object.freeze([
    '13magnus' as AnomalyName,
    'recursion' as AnomalyName,
    'interitus' as AnomalyName,
    'initio' as AnomalyName,
    'helios' as AnomalyName,
    'darsana' as AnomalyName,
    'shonin' as AnomalyName,
    'persepolis' as AnomalyName,
    'abaddon' as AnomalyName,
    'obsidian' as AnomalyName,
    'aegis_nova' as AnomalyName,
    'via_lux' as AnomalyName
]);

export function isValidAnomaly(str: string|AnomalyName): boolean {
    return parseAnomaly(str) == null;
}

export function parseAnomaly(str: string|AnomalyName): AnomalyName|null {
    const anomaly = _.snakeCase(str) as AnomalyName;

    if (anomalies.includes(anomaly)) {
        return null;
    }

    return anomaly;
}

export function isValidFaction(str: string|Faction): boolean {
    return str === 'enlightened' || str === 'resistance' || str === 'unknown' || str === 'error'; 
};

export function parseFaction(str: string|Faction|null): Faction {
    if (str == null) {
        return 'unknown';
    }

    return isValidFaction(str) ? (str as Faction) : 'error';
}

export function isValidLevel(level: Level|number|string): boolean {
    if (typeof level === 'string') {
        level = +level;
        if (isNaN(level)) {
            return false;
        }
    }

    return level >= 0 && level <= 16;
}

export function parseLevel(level: Level|number|string): Level {
    level = +level;
    if (isNaN(level)) {
        return 0;
    }

    return _.clamp(+level, 0, 16) as Level;
}

export function somePromise(values: Promise<boolean>[]): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let resolved = false;

        function resolveIfTrue(value: boolean) {
            if (value && !resolved) {
                resolve(true);
            }
        }

        values.forEach(value => value.then(resolveIfTrue));

        Promise.all(values).then(() => {
            if (!resolved) {
                resolve(false);
            }
        }, reject);
    });
}