/*
 * Helper functions to allow disabling logging.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

let logEnabled = true;

export function setLoggingEnabled(le: boolean): void {
  logEnabled = !!le;
}

function callIfEnabled(method: (...args: any[]) => void, args: any[]): void {
  if (logEnabled) {
    method.apply(console, args);
  }
}

export function warn(message: string, ...args: any[]) {
  console.warn(message, ...args);
}

export function error(message: string, ...args: any[]) {
  console.error(message, ...args);
}

export function assert(...args: any[]) {
  callIfEnabled(console.assert, args);
}

export function trace(...args: any[]) {
  callIfEnabled(console.trace, args);
}

export function log(...args: any[]) {
  callIfEnabled(console.log, args);
}

export function debug(...args: any[]) {
  callIfEnabled(console.debug, args);
}

export function info(...args: any[]) {
  callIfEnabled(console.info, args);
}
