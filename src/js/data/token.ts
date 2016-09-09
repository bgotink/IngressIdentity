/**
 * This file wraps around the Chrome identity API
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import * as log from '../log';

export default class TokenBearer {
  private token: Promise<string>;
  private _onInvalidToken: () => void;

  constructor() {
    this.token = this.tryGetIdentity();
    this._onInvalidToken = () => {};
  }

  private tryGetIdentity() {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (!token) {
          return reject(chrome.runtime.lastError.message);
        }
        resolve(token);
      });
    });
  }

  private getIdentity() {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (!token) {
          return reject(chrome.runtime.lastError.message);
        }
        resolve(token);
      });
    });
  }

  public isAuthorized() {
    return this.token.then(() => true, () => false);
  }

  public authorize() {
    return this.token = this.tryGetIdentity()
      .catch(() => {
        return this.getIdentity();
      });
  }

  public onInvalidToken(fn: () => void) {
    this._onInvalidToken = fn;
  }

  public fetchAuthenticated(url: string, retry: boolean = true): Promise<Response> {
    return this.token.then(token => {
      return fetch(
        url,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      .then(response => {
        if (response.status === 401) {
          log.log('[TokenBearer] Got 401, removing cached authentication token');
          return new Promise((resolve) => {
              chrome.identity.removeCachedAuthToken({ token }, resolve);
            })
            .then(() => {
              if (retry) {
                return this.tryGetIdentity()
                  .then(
                    () => this.fetchAuthenticated(url, false),
                    () => rejectUnauthorized.call(this)
                  );
              } else {
                return rejectUnauthorized.call(this);
              }

              function rejectUnauthorized() {
                const rejected = Promise.reject('Unauthorized: token invalid');
                this.token = rejected;
                
                try {
                  this._onInvalidToken();
                } catch (e) {
                  log.error(e);
                }
                
                return rejected;
              }
            });
        }

        if (!response.ok) {
          throw new Error(`Got HTTP error ${response.status}`);
        }

        return response;
      }, (error: Error) => {
        log.error('Got an error:', error);
        throw error;
      });
    });
  }
}
