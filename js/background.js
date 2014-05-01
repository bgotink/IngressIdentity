/**
 * The main background script, containing listeners for communication, aggregating
 * the data and storing it.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, $, window) {
    var storage = chrome.storage.sync,
        data = null,
        storageCache = {},

        isOptionsPage = function (url) {
            return url.match(new RegExp('chrome-extension:\\/\\/' + chrome.runtime.id + '/options.html.*'));
        },

    // storage functions

        disableUpdateListener = false,
        onDataUpdated = function (changes, areaName) {
            var update = false,
                reload = false,
                key;

            if (disableUpdateListener) {
                module.log.log('Chrome storage update listener disabled, re-enabling');
                disableUpdateListener = false;
                return;
            }

            module.log.log('Settings updated:');
            for (key in changes) {
                if (key in storageCache) {
                    delete storageCache[key];
                }

                module.log.log('- %s', key);

                if (key === 'manifest_keys') {
                    reload = true;
                } else {
                    update = true;
                }
            }

            if (reload) {
                module.log.log('Reloading manifests');
                reloadData(function (err, reloaded) {
                    if (reloaded) {
                        module.log.log('Manifests reloaded');

                        if (err) {
                            err.forEach(module.log.warn);
                        }
                    } else {
                        module.log.error('Error when reloading manifest:');
                        err.forEach(module.log.error);
                    }
                });
            } else if (update) {
                module.log.log('Updating tabs');
                updateTabs();
            }
        },

        getStoredData = function (key, defaultValue, callback) {
            var request = {};
            request[key] = defaultValue;

            if (key in storageCache && storageCache[key].expires > (+new Date)) {
                module.log.log('Got storage { key: %s, value: %s } from storage cache', key, '' + storageCache[key].result);
                callback(storageCache[key].result);
            } else {
                storage.get(request, function (result) {
                    module.log.log('Got storage { key: %s, value: %s } from storage', key, '' + result[key]);

                    storageCache[key] = {
                        result: result[key],
                        expires: (+new Date()) + 60 * 1000
                    };

                    callback(result[key]);
                });
            }
        },

        setStoredData = function (key, value, callback) {
            var request = {};
            request[key] = value;

            module.log.log('Setting storage key %s to %s', key, '' + value);
            storage.set(request, callback);
        },

        getManifestKeys = function (callback) {
            module.log.log('Fetching manifest keys...');
            storage.get({ manifest_keys: [] }, function (result) {
                callback(result.manifest_keys);
            });
        },

        setManifestKeys = function (keys, callback) {
            module.log.log('Setting manifest keys...');
            storage.set({ manifest_keys: keys }, callback);
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
                        data.setLoadingErrors(err);

                        if ('manifests' in storageCache) {
                            delete storageCache.manifests;
                        }

                        updateTabs();
                        callback(null, data.hasLoadingErrors() ? 'warning' : 'success');
                    } else {
                        callback(err, 'failed');
                    }
                });
            });
        },

    // communication functions

        updateTabs = function () {
            chrome.permissions.contains(
                { permissions: ['tabs'] },
                function (hasPermission) {
                    if (!hasPermission) {
                        return;
                    }

                    chrome.tabs.query({}, function(tabs) {
                        var i,
                            length = tabs.length,
                            message = { type: 'update' };
                        module.log.log('Sending update message to %d tabs', length);

                        for (i = 0; i < length; i++) {
                            module.log.log('-- tab ', tabs[i]);
                            chrome.tabs.sendMessage(tabs[i].id, message);
                        }
                    });
                }
            );
        },

    // communication listeners

        messageListeners = {};

    messageListeners.getManifests = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'getManifests\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        if ('manifests' in storageCache) {
            module.log.log('Requesting manifests, loaded from cache');
            sendResponse(storageCache.manifests);

            return false;
        }

        module.log.log('Requesting manifests, loading from source');
        getManifestKeys(function (keys) {
            var result = {},
                manifest,
                manifestData,
                tmp;

            module.log.log('Loaded manifests: ', keys);

            keys.forEach(function (key) {
                manifest = data.getSource(key);
                manifestData = [];

                if (manifest === null) {
                    module.log.error('Strangely manifest %s cannot be found', key);
                } else {
                    manifest.getSources().forEach(function (source) {
                        tmp = {
                            key:     source.getKey(),
                            tag:     source.getTag(),
                            count:   source.getNbPlayers(),
                            version: source.getVersion(),
                            faction: source.getFaction(),
                        };

                        if (source.getUrl() !== null) {
                            tmp.url = source.getUrl();
                        }

                        manifestData.push(tmp);
                    });
                }

                module.log.log('Manifest %s contains the following data:', key);
                module.log.log(manifestData);

                result[key] = {
                    sources: manifestData,
                    url : manifest ? manifest.getUrl() : null
                };
            });

            storageCache.manifests = result;

            module.log.log('Sending result to getManifests: ', result);
            sendResponse(result);
        });

        return true;
    };

    messageListeners.getManifestErrors = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'getManifestErrors\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        if (data === null) {
            sendResponse({});
        } else {
            sendResponse(data.getErrors());
        }

        return false;
    };

    messageListeners.addManifest = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('An \'addManifest\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        disableUpdateListener = true;
        addManifestKey(request.key, function (added) {
            if (!added) {
                disableUpdateListener = false;
                sendResponse({ status: 'duplicate' });
                return;
            }

            reloadData(function (err, status) {
                disableUpdateListener = false;
                sendResponse({ status: status, err: err });
            });
        });

        return true;
    };

    messageListeners.removeManifest = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'removeManifest\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        disableUpdateListener = true;
        removeManifestKey(request.key, function (removed) {
            if (!removed) {
                disableUpdateListener = false;
                sendResponse({ status: 'nonexistent' });
                return;
            }

            reloadData(function (err, status) {
                disableUpdateListener = false;
                sendResponse({ status: status, err: err });
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
            sendResponse({ status: status, err: err });
        });

        return true;
    };

    messageListeners.requestPermission = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'requestPermission\' message can only originate from the options page');
            // silently die by not sending a response
            return;
        }

        var permissions = { permissions: [ request.permission ]};
        module.log.log('Requesting premission %s', request.permission);

        chrome.permissions.contains(
            permissions,
            function (alreadyGranted) {
                if (alreadyGranted) {
                    sendResponse({ granted: true});
                    return;
                }

                chrome.permissions.request(
                    permissions,
                    function (granted) {
                        sendResponse({ granted: granted });
                    }
                );
            }
        );

        return true;
    };

    messageListeners.hasPermission = function (request, sender, sendResponse) {
        chrome.permissions.contains(
            { permissions: [ request.permission ]},
            function (granted) {
                sendResponse({ hasPermission: granted });
            }
        );

        return true;
    };

    messageListeners.revokePermission = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'revokePermission\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        var permissions = { permissions: [ request.permission ]};
        module.log.log('Revoking premission %s', request.permission);

        chrome.permissions.contains(
            permissions,
            function (granted) {
                if (!granted) {
                    sendResponse({ revoked: true});
                    return;
                }

                chrome.permissions.remove(
                    permissions,
                    function (revoked) {
                        sendResponse({ revoked: revoked });
                    }
                );
            }
        );

        return true;
    };

    messageListeners.setOption = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'setOption\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        setStoredData('option-' + request.option, request.value, function () {
            data.invalidateCache();
            updateTabs();
            sendResponse({ result: request.value });
        });

        return true;
    };

    messageListeners.getOption = function (request, sender, sendResponse) {
        getStoredData('option-' + request.option, request.default, function (result) {
            sendResponse({ value: result });
        });

        return true;
    }

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
            var doGetPlayer = function () {
                var player = data.getPlayer(request.oid);

                if (player === null) {
                    sendResponse({ status: 'not-found' });

                    return false;
                }

                if ('anomaly' in player.extra) {
                    getStoredData('option-show-anomalies', true, function (showAnomalies) {
                        if (!showAnomalies) {
                            delete player.extra.anomaly;
                        }

                        sendResponse({ status: 'success', player: player });
                    });

                    return true;
                }

                sendResponse({ status: 'success', player: player });
            };

            if (!('extra' in request) || !('match' in request.extra)) {
                return doGetPlayer();
            }

            getStoredData(
                'option-match-' + request.extra.match,
                true,
                function (doMatch) {
                    if (!doMatch) {
                        sendResponse({ status: 'not-found' });
                        return;
                    }

                    doGetPlayer();
                }
            );

            return true;
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

            var reply = null,
                realRequest;

            if (request.lastUpdate) {
                reply = {};

                realRequest = request.request;
            } else {
                realRequest = request;
            }

            if (realRequest.type in messageListeners) {
                return messageListeners[realRequest.type](realRequest, sender, function (response) {
                    if (reply !== null) {
                        reply.reply = response;
                        reply.shouldUpdate = data === null ? false : data.shouldUpdateRemote(request.lastUpdate);
                    } else {
                        reply = response;
                    }

                    sendResponse(reply);
                });
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

            window.setInterval(function () {
                if (data === null)
                    return;

                module.log.log('Performing hourly update...');
                data.update(function (updated) {
                    if (updated) {
                        data.invalidateCache();
                        updateTabs();
                    }
                })
            }, 60 * 60 * 1000);
        }});

        chrome.storage.onChanged.addListener(onDataUpdated);
    });
})(window.iidentity, window.jQuery, window);
