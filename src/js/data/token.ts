/**
 * This file wraps around the Chrome identity API
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

export default class TokenBearer {
  private token: Promise<string>;

  constructor() {
    this.token = this.tryGetIdentity();
  }

  private tryGetIdentity() {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (!token) {
          return reject();
        }
        resolve(token);
      });
    });
  }

  private getIdentity() {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (!token) {
          return reject();
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

  public fetchAuthenticated(url: string, retry?: boolean): Promise<Response> {
    return this.token.then(token => {
      return fetch(
        url,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      .then(response => {
        if (response.status === 401) {
          return new Promise((resolve) => {
              chrome.identity.removeCachedAuthToken({ token }, resolve);
            })
            .then(() => {
              if (retry !== false) {
                const rejected = Promise.reject('Unauthorized: token invalid');
                this.token = rejected;
                return rejected;
              }

              return this.tryGetIdentity()
                .then(() => this.fetchAuthenticated(url, false));
            });
        }

        if (response.status !== 200) {
          throw new Error(`Got HTTP error ${response.status}`);
        }

        return response;
      });
    });
  }
}
