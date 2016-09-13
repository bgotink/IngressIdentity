/**
 * This file wraps around the Chrome identity API
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import * as log from '../log';

const STATUS_NOT_AUTHENTICATED = 'UNAUTHENTICATED';

function wrapError(e: any): Error {
  return e instanceof Error ? e : new Error(e);
}

interface ErrorInfo {
  code: number;
  message: string;
  status: string;
};

export default class TokenBearer {
  private token: string | null;
  private tokenError: Error | null;
  private readyPromise: Promise<void>;
  private _onInvalidToken: () => void;

  constructor() {
    const tokenPromise = this.tryGetIdentity();
    this.readyPromise = tokenPromise.then(
      token => this.token = token,
      e => this.tokenError = wrapError(e)
    );

    this._onInvalidToken = () => {};
  }

  private async tryGetIdentity(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (!token) {
          return reject(chrome.runtime.lastError.message);
        }
        resolve(token);
      });
    });
  }

  private async getIdentity(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (!token) {
          return reject(chrome.runtime.lastError.message);
        }
        resolve(token);
      });
    });
  }

  public async ready() {
    await this.readyPromise;
  }

  public isAuthorized() {
    return typeof this.token === 'string';
  }

  private async doAuthorize() {
    try {
      await this.clearToken();
    } catch (e) {
      log.warn('Got error %s while clearing token, ignoring...', e);
    }

    try {
      this.token = await this.tryGetIdentity();
      this.tokenError = null;
    } catch (_) {
      try {
        this.token = await this.getIdentity();
        this.tokenError = null;
      } catch (e) {
        this.tokenError = wrapError(e);
        throw e;
      }
    }
  }

  public async authorize() {
    const authorization = this.doAuthorize();

    this.readyPromise = authorization.then(() => {}, () => {});

    await authorization;
  }

  public onInvalidToken(fn: () => void) {
    this._onInvalidToken = fn;
  }

  private async clearToken() {
    if (!this.token) {
      return;
    }

    await new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token: this.token }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
          return;
        }

        resolve();
      });
    });
    this.token = null;
  }

  public async fetchAuthenticated(url: string, retry: boolean = true): Promise<Response> {
    let token: string;

    function _throwUnauthorized(e: any): Response {
      this.tokenError = wrapError(e);

      try {
        this._onInvalidToken();
      } catch (e) {
        log.error(e);
      }

      throw e;
    }

    if (this.token && !this.tokenError) {
      token = this.token;
    } else {
      try {
        token = await (this.readyPromise = this.tryGetIdentity());
        this.token = token;
        this.tokenError = null;
      } catch (e) {
        return _throwUnauthorized.call(this, e);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      // Something went wrong...
      log.error(e);
      throw e;
    }

    if (response.status === 401) {
      const errorInfo: ErrorInfo = await response.json();

      if (errorInfo.status === STATUS_NOT_AUTHENTICATED) {
        await this.clearToken();

        if (retry) {
          return this.fetchAuthenticated(url, false);
        }

        return _throwUnauthorized.call(this, new Error('Unauthorized: token invalid'));
      }
    }

    if (!response.ok) {
      const e = new Error(`Got HTTP error ${response.status}`);
      (e as any).status = response.status;
      throw e;
    }

    return response;
  }
}
