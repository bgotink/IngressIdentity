/*
 * A simple cache.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import _ from 'lodash';

interface CacheEntry<T> {
  expire: number;
  value: T;
}

export default class Cache<T> {
  private data: { [s: string]: CacheEntry<T> };

  constructor() {
    this.clear();
  }

  has(key: string) {
    if (!_.has(this.data, key)) {
      return false;
    }

    const { expire } = this.data[key];

    return expire == null || Date.now() < expire;
  }

  get(key: string) {
    if (!this.has(key)) {
      return null;
    }

    return this.data[key].value;
  }

  set(key: string, value: T, expire = 60000) {
    this.data[key] = {
      value, expire: expire ? Date.now() + expire : null
    };
  }

  remove(key: string) {
    if (_.has(this.data, key)) {
      delete this.data[key];
    }
  }

  clear() {
    this.data = {};
  }
}
