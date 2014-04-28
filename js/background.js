/**
 * The main background script, containing listeners for communication, aggregating
 * the data and storing it.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, $) {
    var storage = chrome.storage.sync,
        data = null,

        isOptionsPage = function (url) {
            return url.match(new RegExp('chrome-extension:\\/\\/' + chrome.runtime.id + '/options.html.*'));
        },

    // storage functions

        getManifestKeys = function (callback) {
            module.log.log('Fetching manifest keys...');
            return storage.get({ manifest_keys: [] }, function (result) {
                callback(result.manifest_keys);
            });
        },

        setManifestKeys = function (keys, callback) {
            module.log.log('Setting manifest keys...');
            storage.set({ manifest_keys: keys}, callback);
        },

        addManifestKey = function (key, callback) {
            getManifestKeys(function (keys) {
                if (keys.indexOf(key) !== -1) {
                    module.log.log('manifest key %s already loaded', key);
                    callback(false);
                    return;
                }

                module.log.log('adding manifest key %s', key);
                keys.push(key);

                setManifestKeys(keys, function () {
                    callback(true);
                });
            });
        },

        removeManifestKey = function (key, callback) {
            getManifestKeys(function (keys) {
                if (keys.indexOf(key) === -1) {
                    callback(false);
                    return;
                }

                keys.splice(
                    keys.indexOf(key),
                    1
                );

                setManifestKeys(keys, function () {
                    callback(true);
                });
            });
        },

    // data functions

        reloadData = function (callback) {
            getManifestKeys(function (storedData) {
                module.data.loadManifests(storedData, function (err, newData) {
                    if (newData !== null) {
                        data = newData;

                        updateTabs();
                        callback(err, true);
                    } else {
                        callback(err, false);
                    }
                });
            });
        },

    // communication functions

        updateTabs = function () {
            // impossible without the "tabs" permission
            // (or we could use ports, but they have their disadvantages)
            // TODO
        },

    // communication listeners

        messageListeners = {};

    messageListeners.getManifests = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'getManifests\' message can only originate from the options page');
            // silently die by not sending a response
            return;
        }

        getManifestKeys(function (keys) {
            var result = {},
                manifest,
                manifestData;

            module.log.log('Loaded manifests: ', keys);

            keys.forEach(function (key) {
                manifest = data.getSource(key);
                manifestData = [];

                if (manifest === null) {
                    module.log.error('Strangely this manifest cannot be found');
                    return;
                }

                manifest.getSources().forEach(function (source) {
                    manifestData.push({
                        key:     source.getKey(),
                        tag:     source.getTag(),
                        count:   source.getNbPlayers(),
                        version: source.getVersion(),
                        faction: source.getFaction(),
                    });
                });

                module.log.log('Manifest %s contains the following data:', key);
                module.log.log(manifestData);

                result[key] = manifestData;
            });

            module.log.log('Sending result to getManifests: ', result);
            sendResponse(result);
        });

        return true;
    };

    messageListeners.addManifest = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('An \'addManifest\' message can only originate from the options page');
            // silently die by not sending a response
            return;
        }

        addManifestKey(request.key, function (added) {
            if (!added) {
                sendResponse({ status: 'duplicate' });
                return;
            }

            reloadData(function (err, status) {
                sendResponse({ status: status ? 'success' : 'failed', err: err });
            });
        });

        return true;
    };

    messageListeners.removeManifest = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'removeManifest\' message can only originate from the options page');
            // silently die by not sending a response
            return;
        }

        removeManifestKey(request.key, function (removed) {
            if (!removed) {
                sendResponse({ status: 'nonexistent' });
                return;
            }

            reloadData(function (err, status) {
                sendResponse({ status: status ? 'success' : 'failed', err: err });
            });
        });

        return true;
    };

    messageListeners.reloadData = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'reloadData\' message can only originate from the options page');
            // silently die by not sending a response
            return;
        }

        reloadData(function (err, status) {
            sendResponse({ status: status ? 'success' : 'failed', err: err });
        });

        return true;
    };

    messageListeners.hasPlayer = function (request, sender, sendResponse) {
        if (data === null) {
            sendResponse({ result: false });
        } else {
            sendResponse({ result: data.hasPlayer(request.oid) });
        }

        return false;
    };

    messageListeners.getPlayer = function (request, sender, sendResponse) {
        if (data === null) {
            sendResponse({ status: 'not-found' });
        } else {
            var player = data.getPlayer(request.oid);

            if (player !== null) {
                sendResponse({ status: 'success', player: player});
            } else {
                sendResponse({ status: 'not-found' });
            }
        }

        return false;
    };

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (sender.tab) {
                module.log.log('Got request from tab %s, url: %s', sender.tab.id, sender.url);
            } else {
                module.log.error('Got request from this backgroundpage?');
                // silently ignore
                return;
            }

            if (request.type in messageListeners) {
                return messageListeners[request.type](request, sender, sendResponse);
            } else {
                module.log.error('Unknown message type: %s', request.type);
                module.log.error('Request: ', request);
                module.log.error('Sender: ', sender);

                return false;
            }
        }
    );

    $(function () {
        google.load("visualization", "1", { callback: function () {
            reloadData(function(err, success) {
                if (success) {
                    module.log.log('Successfully loaded existing configuration');
                    if (err) {
                        err.forEach(function (e) { module.log.warn(e); });
                    }
                } else {
                    module.log.error('Something went wrong while loading existing configuration');
                    err.forEach(function (e) { module.log.error(e); });
                }
            });
        }});
    });
})(window.iidentity, window.jQuery);
