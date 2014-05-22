/**
 * Interpret, cache and merge player data.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module, $) {
    'use strict';

    var exports = (Object.has(module, 'data') ? module.data : (module.data = {})),

    // unexported helper functions and classes

        resolveKey = function (key, parent, err) {
            var data = exports.spreadsheets.parseKey(key),
                parentData;

            if (!Object.isString(data.key) || data.key.isBlank()) {
                parentData = exports.spreadsheets.parseKey(parent);

                if (!Object.isString(parentData.key) || parentData.key.isBlank()) {
                    if (err) {
                        err.push('Cannot resolve key ' + key);
                    }
                    return false;
                }

                data.key = exports.spreadsheets.parseKey(parent).key;
            }

            if (!Object.has(data, 'gid')) {
                return data.key;
            }

            return '{key}?gid={gid}'.assign(data);
        },

        PlayerSource = Class.extend({
            init: function (key, spreadsheet, data, players) {
                this.key = key;
                this.spreadsheet = spreadsheet;
                this.data = data;
                this.err = data.getErr();
                this.timestamp = +new Date();

                this.setPlayers(players);

                this.loadingErrors = null;
            },

            setPlayers: function (players) {
                this.players = {};
                var newPlayers = this.players;
                players.each(function (player) {
                    if (!(Object.isNumber(player.oid) || Object.isString(player.oid))
                                || ('' + player.oid).match(/^9*$/)) {
                        return;
                    }

                    newPlayers[player.oid] = player;
                });
            },

            hasPlayer: function (oid) {
                return (oid in this.players);
            },
            getPlayer: function (oid) {
                if (!this.hasPlayer(oid)) {
                    return null;
                }

                return exports.interpreter.interpretSourceEntry(
                    this.data,
                    this.players[oid]
                );
            },

            getNbPlayers: function () {
                return Object.size(this.players);
            },

            getKey: function () {
                return this.key;
            },
            getTag: function () {
                return this.data.getTag();
            },
            getVersion: function () {
                return this.data.getVersion();
            },
            getFaction: function () {
                return this.data.getFaction();
            },

            getTimestamp: function () {
                return this.timestamp;
            },
            getUpdateInterval: function () {
                return Math.floor(this.data.refresh) * 60 * 60 * 1000;
            },

            isCombined: function () {
                return false;
            },

            shouldUpdate: function () {
                return (+new Date()) > (this.getTimestamp() + this.getUpdateInterval());
            },
            setUpdated: function () {
                this.timestamp = +new Date();
                return this;
            },
            update: function (callback) {
                var self = this;

                module.log.log('Updating source %s', this.getKey());
                this.spreadsheet.load(function (err, players) {
                    if (players) {
                        module.log.log('Had %d players, now %d', self.players.length, players.length);
                        self.setPlayers(players);
                        self.setUpdated();

                        if (err) {
                            err.forEach(module.log.warn);
                        }

                        callback(true);
                    } else {
                        err.forEach(module.log.error);

                        callback(false);
                    }
                });
            },

            hasErrors: function () {
                return this.err.length > 0;
            },
            getErrors: function () {
                return $.extend({}, this.err, this.loadingErrors);
            },

            hasLoadingErrors: function () {
                return !!this.loadingErrors;
            },
            setLoadingErrors: function (err) {
                if (!err || !Array.isArray(err)) {
                    this.loadingErrors = null;
                } else {
                    this.loadingErrors = err.length === 0 ? null : err;
                }
            },

            getUrl: function () {
                return this.spreadsheet.getUrl();
            },

            hasExtra: function (tag, oid) {
                return this.data.hasExtra(tag, oid);
            },
        }),

        ErroredPlayerSource = Class.extend({
            init: function (key, data, err) {
                this.key = key;
                this.data = data;
                this.err = err;
            },

            getKey: function () {
                return this.key;
            },
            getTag: function () {
                return this.data.getTag();
            },
            getVersion: function () {
                return this.data.getVersion();
            },
            getFaction: function () {
                return this.data.getFaction();
            },

            getNbPlayers: function () {
                return 0;
            },

            getUrl: function () {
                return exports.spreadsheets.keyToUrl(this.key);
            },

            hasErrors: function () {
                return true;
            },
            getErrors: function () {
                return this.err;
            },

            hasLoadingErrors: function () {
                return true;
            },
            setLoadingErrors: function (err) {
                if (err) {
                    this.loadingErrors = err;
                }
            },

            hasExtra: function () {
                return false;
            },

            getTimestamp: function () {
                return +new Date;
            },
            getUpdateInterval: function () {
                return Infinity;
            },

            isCombined: function () {
                return false;
            },

            shouldUpdate: function () {
                return false;
            },
            setUpdated: function () {
                return this;
            },
            update: function (callback) {
                callback(false);
            },
        }),

        CombinedPlayerSource = Class.extend({
            init: function (sources, key, spreadsheet) {
                this.sources = sources;

                this.key = key || 0;
                this.spreadsheet = spreadsheet || null;

                this.cache = {};
                this.timestamp = +new Date;

                this.loadingErrors = null;

                this.topLevel = false;
            },

            setTopLevel: function () {
                this.topLevel = true;

                return this;
            },

            getKey: function () {
                return this.key;
            },

            hasPlayer: function (oid) {
                if (typeof this.cache[oid] !== 'undefined') {
                    return this.cache[oid] !== null;
                }

                return this.sources.some(function (source) {
                    return source.hasPlayer(oid);
                });
            },
            getPlayer: function (oid) {
                if (Object.has(this.cache, oid)) {
                    return this.cache[oid];
                }

                var data = [ {} ],
                    result,
                    err = [];

                this.sources.forEach(function (source) {
                    result = source.getPlayer(oid);

                    if (result !== null) {
                        data.push(result);
                    }
                });

                if (data.length < 2) {
                    return this.cache[oid] = null;
                }

                module.log.log('Merging ', data, ' into one player object:');

                result = exports.merge(data, err);
                if (this.topLevel) {
                    exports.merge.validate(result, err);
                }

                module.log.log('Got', result, 'errors', err);

                if (Object.has(result, 'err')) {
                    result.err = result.err.concat(err);
                } else {
                    result.err = err;
                }

                return this.cache[oid] = result;
            },

            getSources: function () {
                return this.sources;
            },
            getSource: function (key) {
                var sources = this.sources,
                    length = sources.length,
                    i;

                key = resolveKey(key, this.getKey(), []);

                for (i = 0; i < length; i++) {
                    if (sources[i].getKey() == key) {
                        return sources[i];
                    }
                }

                return null;
            },

            isCombined: function () {
                return true;
            },

            invalidateCache: function () {
                this.getSources().each(function (source) {
                    if (source.isCombined()) {
                        source.invalidateCache();
                    }
                });

                this.cache = {};

                return this;
            },

            shouldUpdateRemote: function (remoteTimestamp) {
                return remoteTimestamp < this.timestamp;
            },
            shouldUpdate: function () {
                return true;
            },
            update: function (callback) {
                var origCallback = callback,
                    self = this;
                callback = function (updated) {
                    if (updated) {
                        self.timestamp = +new Date();
                    }

                    origCallback(updated);
                }

                if (this.spreadsheet) {
                    var source,
                        step,
                        length;

                    module.log.log('Updating manifest %s', this.key);
                    this.spreadsheet.load(function (err, data) {
                        length = data.length;

                        step = function (i, updated) {
                            if (i >= length) {
                                callback(updated);
                                return;
                            }

                            source = self.getSource(data[i].key);
                            if (source === null) {
                                loadSource(data[i], self.key, function (err, source) {
                                    if (source) {
                                        module.log.log('Adding new source sheet %s', data[i].key)
                                        self.sources.push(source);
                                        if (err) {
                                            err.forEach(module.log.warn);
                                        }

                                        step(i + 1, true);
                                    } else {
                                        if (err !== null && err.length !== 0) {
                                            module.log.error('Error occured while adding source');
                                            err.forEach(module.log.error);
                                        }

                                        step(i + 1, updated);
                                    }
                                });
                            } else {
                                if (source.shouldUpdate()) {
                                    if (source.getVersion() !== data[i].lastupdated) {
                                        module.log.log('Updating source sheet %s from version %s to %s', data[i].key, source.getVersion(), data[i].lastupdated);
                                        source.data = data[i];
                                        source.update(function (u) {
                                            step(i + 1, updated || u);
                                        });
                                    } else {
                                        source.setUpdated();
                                        step(i + 1, updated);
                                    }
                                } else {
                                    step(i + 1, updated);
                                }
                            }
                        };
                        step(0, false);
                    });
                } else {
                    var sources = this.getSources(),
                        length = sources.length;

                    module.log.log('Updating collection of manifests');
                    step = function (i, updated) {
                        if (i >= length) {
                            callback(updated);
                            return;
                        }

                        if (sources[i].shouldUpdate()) {
                            sources[i].update(function (u) {
                                step(i + 1, updated || u);
                            });
                        } else {
                            step(i + 1, updated);
                        }
                    };
                    step(0, false);
                }

                return this;
            },

            hasErrors: function () {
                return this.getSources().some(function (source) {
                    return source.hasErrors();
                });
            },
            getErrors: function () {
                var errors = {};

                this.getSources().forEach(function (source) {
                    if (source.hasErrors()) {
                        errors[source.getKey()] = source.getErrors();
                    }
                });

                return $.extend(true, {}, errors, this.loadingErrors);
            },

            hasLoadingErrors: function () {
                return !!this.loadingErrors || this.getSources().some(function (source) { return source.hasLoadingErrors(); });
            },
            setLoadingErrors: function (err) {
                if (!err || !Array.isArray(err)) {
                    this.loadingErrors = null;
                } else {
                    this.loadingErrors = err.length === 0 ? null : err;
                    return;
                }

                this.getSources().each(function (source) {
                    if (Object.isObject(err) && Object.has(err, source.getKey())) {
                        source.setLoadingErrors(
                            err[source.getKey()]
                        );
                    } else {
                        source.setLoadingErrors(null);
                    }
                });

                return this;
            },

            getUrl: function () {
                return this.spreadsheet ? this.spreadsheet.getUrl() : null;
            },

            getSourcesForExtra: function (tag, oid) {
                var result = [];

                this.getSources().each(function (source) {
                    if (source.isCombined()) {
                        result.push(source.getSourcesForExtra(tag, oid));
                    } else if (source.hasExtra(tag, oid)) {
                        result.push([{
                            url: source.getUrl(),
                            key: source.getTag()
                        }]);
                    }
                });

                return result.reduce(function (res, elem) {
                    return res.concat(elem);
                }, []);
            },
        }),

        loadSource = function (data, parentKey, callback) {
            var err = [],
                key = resolveKey(data.key, parentKey || '', err),
                source = new exports.spreadsheets.Source(key);

            // ignore dummy rows!
            if (key.compact().match(/^9+$/)) {
                callback(null, null);
                return;
            }

            source.load(function (err2, players) {
                if (err2 != null) {
                    err = err.concat(err2);
                }

                if (players === null) {
                    callback(err, new ErroredPlayerSource(key, exports.interpreter.interpretManifestEntry(data), err));
                    return;
                }

                callback(err, new PlayerSource(
                    key,
                    source,
                    exports.interpreter.interpretManifestEntry(data),
                    players
                ));
            });
        },

        loadManifest = function (key, callback) {
            var manifest = new exports.spreadsheets.Manifest(key),
                sources = [];

            manifest.load(function (merr, sourcesData) {
                module.log.log('Loaded manifest ', key, ', got ', sourcesData, 'err: ', merr);
                if (sourcesData === null) {
                    callback({ __errors: merr }, null);
                    return;
                }

                var err = {};
                if (merr !== null) {
                    err.__errors = merr;
                }

                var nbSources = sourcesData.length,
                    step = function (i) {
                        if (i >= nbSources) {
                            callback(
                                Object.size(err) > 0 ? err : null,
                                new CombinedPlayerSource(sources, key, manifest)
                            );
                            return;
                        }

                        var skey = sourcesData[i].key;

                        loadSource(sourcesData[i], key, function (err2, source) {
                            if (err2) {
                                err[(source === null) ? skey : source.getKey()] = err2;
                            }

                            if (source !== null) {
                                sources.push(source);
                            }

                            step(i + 1);
                        });
                    };

                step(0);
            });
        },

        loadManifests = function (keys, callback) {
            var nbKeys = keys.length,
                sources = [],
                err = {},
                key,
                step = function (i) {
                    if (i >= nbKeys) {
                        callback(
                            Object.size(err) > 0 ? err : null,
                            sources.length > 0 ? (new CombinedPlayerSource(sources)).setTopLevel() : null
                        );
                        return;
                    }

                    key = resolveKey(keys[i], '', err);

                    loadManifest(key, function (err2, manifest) {
                        if (err2) {
                            err[keys[i]] = err2;
                        }

                        if (manifest !== null) {
                            sources.push(manifest);
                        }

                        step(i + 1);
                    });
                };

            step(0);
        };

    // exported functions
    exports.loadManifests = loadManifests;

    exports.resolveKey = resolveKey;
})(window.iidentity, window.jQuery);
