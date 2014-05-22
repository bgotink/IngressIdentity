/**
 * The main background script, containing listeners for communication, aggregating
 * the data and storing it.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module, $, window) {
    'use strict';

    var storage = chrome.storage.sync,
        data = null,
        storageCache = {},

        isOptionsPage = function (url) {
            return !!url.match(new RegExp('chrome-extension:\\/\\/' + chrome.runtime.id + '/options.html.*'));
        },

    // storage functions

        disableUpdateListener = false,
        onDataUpdated = function (changes) {
            var update = false,
                reload = false;

            if (disableUpdateListener) {
                module.log.log('Chrome storage update listener disabled, re-enabling');
                disableUpdateListener = false;
                return;
            }

            module.log.log('Settings updated:');
            Object.each(changes, function (key) {
                if (Object.has(storageCache, key)) {
                    delete storageCache[key];
                }

                module.log.log('- %s', key);

                if (key === 'manifest_keys') {
                    reload = true;
                } else {
                    update = true;
                }
            });

            if (reload) {
                module.log.log('Reloading manifests');
                reloadData(function (err, reloaded) {
                    if (reloaded) {
                        module.log.log('Manifests reloaded');

                        if (err) {
                            err.each(module.log.warn);
                        }
                    } else {
                        module.log.error('Error when reloading manifest:');
                        err.each(module.log.error);
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

            if (Object.has(storageCache, key) && storageCache[key].expires > (+new Date)) {
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
                callback(result.manifest_keys.map(function (e) {
                    return module.data.resolveKey(e, '');
                }));
            });
        },

        setManifestKeys = function (keys, callback) {
            module.log.log('Setting manifest keys...');
            storage.set({ manifest_keys: keys }, callback);
        },

        addManifestKey = function (key, name, callback) {
            getManifestKeys(function (keys) {
                key = key.compact();

                if (!keys.none(key)) {
                    module.log.log('manifest key %s already loaded', key);
                    callback(false);
                    return;
                }

                module.log.log('adding manifest key %s', key);
                keys.push(key);

                setManifestKeys(keys, function () {
                    if (!Object.isString(name) || name.isBlank()) {
                        callback(true);
                        return;
                    }

                    getStoredData('manifest_names', {}, function (names) {
                        names[key] = name.compact();

                        setStoredData('manifest_names', names, function () {
                            callback(true);
                        });
                    });
                });
            });
        },

        removeManifestKey = function (key, callback) {
            getManifestKeys(function (keys) {
                if (keys.none(key)) {
                    callback(false);
                    return;
                }

                keys.remove(key);

                setManifestKeys(keys, function () {
                    callback(true);
                });
            });
        },

        renameManifest = function (key, oldName, newName, callback) {
            if ((!Object.isString(oldName) || oldName.isBlank())
                    && (!Object.isString(newName) || newName.isBlank())) {
                callback(true);
                return;
            }

            if (('' + oldName).compact() === ('' + newName).compact()) {
                callback(true);
                return;
            }

            getStoredData('manifest_names', {}, function (names) {
                if (Object.isString(oldName) && !oldName.isBlank()) {
                    if (!Object.has(names, key) || names[key] !== oldName) {
                        callback(false);
                        return;
                    }
                } else {
                    if (Object.has(names, key) && !names[key].isBlank()) {
                        callback(false);
                        return;
                    }
                }

                if (Object.isString(newName) && !newName.isBlank()) {
                    names[key] = newName.compact();
                } else {
                    delete names[key];
                }

                setStoredData('manifest_names', names, function () {
                    if (Object.has(storageCache, 'manifest_names')) {
                        delete storageCache.manifest_names;
                    }
                    if (Object.has(storageCache, 'manifests')) {
                        delete storageCache.manifests;
                    }

                    callback(true);
                });
            });
        },

        changeManifestOrder = function (oldOrder, newOrder, callback) {
            getManifestKeys(function (currentOrder) {
                var i,
                    length = currentOrder.length;

                if (oldOrder.length !== length || newOrder.length !== length) {
                    callback('failed');
                    return;
                }

                // check if old order is still correct
                for (i = 0; i < length; i++) {
                    if (oldOrder[i] !== currentOrder[i]) {
                        callback('failed');
                        return;
                    }
                }

                // check if the keys in the old one are still in the new one
                // and if the keys of the new one are also in the old one
                for (i = 0; i < length; i++) {
                    if (oldOrder.none(newOrder[i])
                            || newOrder.none(oldOrder[i])) {
                        callback('failed');
                        return;
                    }
                }

                // set new order
                setManifestKeys(newOrder, function () {
                    callback('success');
                })
            });
        },

    // data functions

        reloadData = function (callback) {
            getManifestKeys(function (storedData) {
                module.data.loadManifests(storedData, function (err, newData) {
                    if (newData !== null) {
                        data = newData;
                        data.setLoadingErrors(err);

                        if (Object.has(storageCache, 'manifests')) {
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
            chrome.tabs.query({}, function(tabs) {
                var message = { type: 'update' };
                module.log.log('Sending update message to %d tabs', tabs.length);

                tabs.each(function (tab) {
                    module.log.log('-- tab ', tab);
                    chrome.tabs.sendMessage(tab.id, message);
                });
            });
        },

    // communication listeners

        messageListeners = {};

    messageListeners.getManifests = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'getManifests\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        if (Object.has(storageCache, 'manifests')) {
            module.log.log('Requesting manifests, loaded from cache');
            sendResponse(storageCache.manifests);

            return false;
        }

        module.log.log('Requesting manifests, loading from source');
        getManifestKeys(function (keys) {
            getStoredData('manifest_names', {} , function (names) {
                var result = {},
                    manifest,
                    manifestData,
                    tmp;

                module.log.log('Loaded manifests: ', keys);

                if (data === null) {
                    module.log.log('Data not loaded, yet, returning empty reply');
                    sendResponse({});

                    return false;
                }

                keys.each(function (key) {
                    manifest = data.getSource(key);
                    manifestData = [];

                    if (manifest === null) {
                        module.log.error('Strangely manifest %s cannot be found', key);
                    } else if (manifest.isCombined()) {
                        manifest.getSources().each(function (source) {
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
                        name: Object.has(names, key) ? names[key] : null,
                        sources: manifestData,
                        url : manifest ? manifest.getUrl() : null
                    };
                });

                storageCache.manifests = result;

                module.log.log('Sending result to getManifests: ', result);
                sendResponse(result);
            });
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
        addManifestKey(request.key, request.name, function (added) {
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

    messageListeners.renameManifest = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'renameManifest\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        module.log.log('Renaming manifest ', request.key, ' from ', request.oldName, ' to ', request.newName);
        renameManifest(request.key, request.oldName, request.newName, function (status) {
            sendResponse({ status: status ? 'success' : 'failed' });
        });

        return true;
    };

    messageListeners.changeManifestOrder = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'changeManifestOrder\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        module.log.log('Requesting to change order from ', request.oldOrder, ' to ', request.newOrder);
        changeManifestOrder(request.oldOrder, request.newOrder, function (status) {
            sendResponse({ status: status });
        });

        return true;
    };

    messageListeners.reloadData = function (request, sender, sendResponse) {
        if (!isOptionsPage(sender.url)) {
            module.log.error('A \'reloadData\' message can only originate from the options page');
            // silently die by not sending a response
            return false;
        }

        reloadData(function (err, status) {
            sendResponse({ status: status, err: err });
        });

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
        getStoredData('option-' + request.option, request.defaultValue, function (result) {
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

    messageListeners.getSourcesForExtra = function (request, sender, sendResponse) {
        if (data === null) {
            sendResponse({ result: [] });
        } else {
            getStoredData('option-match-extra-' + request.tag, true, function (match) {
                if (!match) {
                    sendResponse({ result: [] });
                } else {
                    sendResponse({ result: data.getSourcesForExtra(request.tag, request.oid) });
                }
            })
        }

        return true;
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

                if (Object.has(player.extra, 'anomaly')) {
                    getStoredData('option-show-anomalies', true, function (showAnomalies) {
                        if (!showAnomalies) {
                            delete player.extra.anomaly;
                        }

                        sendResponse({ status: 'success', player: player });
                    });

                    return true;
                }

                sendResponse({ status: 'success', player: player });

                return false;
            };

            if (!Object.has(request, 'extra') || !Object.has(request.extra, 'match')) {
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

            if (Object.has(messageListeners, realRequest.type)) {
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

                        if (Object.has(storageCache, 'manifests')) {
                            delete storageCache.manifests;
                        }

                        updateTabs();
                    }
                })
            }, 60 * 60 * 1000);
        }});

        chrome.storage.onChanged.addListener(onDataUpdated);
    });
})(window.iidentity, window.jQuery, window);
