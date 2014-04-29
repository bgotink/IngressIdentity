/**
 * Interpret, cache and merge player data.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, $) {
    var exports = module.data = {},

        anomalies = [ '13magnus', 'recursion', 'interitus' ],

    // unexported helper functions and classes

        getExtraDataValueName = function (str) {
            var i = str.indexOf(':');

            if (i === -1) {
                return str.trim();
            } else {
                return str.substr(0, i).trim();
            }
        },
        addToArray = function (src, dst) {
            if (!Array.isArray(src)) {
                src = [ src ];
            }

            var existing = [],
                name;

            dst.forEach(function (elem) {
                existing.push(getExtraDataValueName(elem));
            });

            src.forEach(function (elem) {
                name = getExtraDataValueName(elem);

                if (existing.indexOf(name) === -1) {
                    dst.push(elem);
                    existing.push(name);
                }
            });
        },
        merge_player = function () {
            if (arguments.length === 0) {
                return false;
            } else if (arguments.length == 1) {
                return arguments[0];
            }

            var target = arguments[0],
                src = arguments[1],
                newArguments,
                key,
                extraKey,
                tmp;

            if (typeof target.extra !== 'object') {
                target.extra = {};
            }

            for (key in src) {
                if (key === 'err') {
                    if (Array.isArray(src.err)) {
                        if ('err' in target) {
                            if (Array.isArray(target.err)) {
                                target.err = target.err.join(src.err);
                            } else {
                                target.err = src.err;
                            }
                        } else {
                            target.err = src.err;
                        }
                    }
                } else if (key === 'extra') {
                    for (extraKey in src.extra) {
                        if (extraKey in target.extra) {
                            if (Array.isArray(target.extra[extraKey])) {
                                addToArray(
                                    src.extra[extraKey],
                                    target.extra[extraKey]
                                );
                            } else {
                                tmp = [ target.extra[extraKey] ];
                                addToArray(
                                    src.extra[extraKey],
                                    tmp
                                );

                                if (tmp.length > 1) {
                                    target.extra[extraKey] = tmp;
                                }
                            }
                        } else {
                            target.extra[extraKey] = src.extra[extraKey];
                        }
                    }
                } else {
                    target[key] = src[key];
                }
            }

            newArguments = Array.prototype.slice.call(arguments, 1);
            newArguments[0] = target;
            return merge_player.apply(null, newArguments);
        },

        PlayerSource = Class.extend({
            init: function (key, query, data, players) {
                this.key = key;
                this.query = query;
                this.data = data;
                this.err = [];
                this.timestamp = +new Date();

                if ('extratags' in data) {
                    try {
                        data.extratags = JSON.parse(data.extratags);
                    } catch (e) {
                        this.err.push('Invalid JSON in extratags: ' + e.message);
                        data.extratags = {};
                    }
                } else {
                    data.extratags = {};
                }

                if ('anomaly' in data.extratags) {
                    var anomaly = data.extratags.anomaly;

                    if (anomalies.indexOf(anomaly) === -1) {
                        this.err.push('Invalid anomaly: ' + anomaly);
                        delete data.extratags.anomaly;
                    }
                }

                if ('community' in data.extratags) {
                    var community = data.extratags.community;

                    if (community.indexOf(':') === -1) {
                        this.err.push('Invalid community: "' + community + '"');
                        delete data.extratags.community;
                    }
                }

                this.setPlayers(players);
            },

            setPlayers: function (players) {
                this.players = {};
                var newPlayers = this.players;
                players.forEach(function (player) {
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

                return $.extend(
                    true,
                    {
                        faction: this.data.faction,
                        extra: this.data.extratags
                    },
                    this.players[oid]
                );
            },

            getNbPlayers: function () {
                return Object.keys(this.players).length;
            },

            getKey: function () {
                return this.key;
            },
            getTag: function () {
                return this.data.tag;
            },
            getVersion: function () {
                return this.data.lastupdated;
            },
            getFaction: function () {
                return this.data.faction;
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
                this.query.load(function (err, players) {
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
                return this.err;
            },
        }),

        CombinedPlayerSource = Class.extend({
            init: function (sources, key, query) {
                this.sources = sources;

                this.key = key || 0;
                this.query = query || null;

                this.cache = {};
                this.timestamp = +new Date;
            },

            getKey: function () {
                return this.key;
            },

            hasPlayer: function (oid) {
                if (typeof this.cache[oid] !== 'undefined') {
                    return true;
                }

                return this.sources.some(function (source) {
                    return source.hasPlayer(oid);
                });
            },
            getPlayer: function (oid) {
                if (typeof this.cache[oid] !== 'undefined') {
                    return this.cache[oid];
                }

                var data = [ {} ],
                    result,
                    faction;

                this.sources.forEach(function (source) {
                    result = source.getPlayer(oid);

                    if (result !== null) {
                        data.push(result);
                    }
                });

                if (data.length < 2) {
                    return null;
                }

                faction = data[1].faction;
                if (data.some(function (elem) {
                    return elem.faction && (elem.faction !== faction);
                })) {
                    data[0].err = ['Player ' + data[0].name + ' [' + data[0].nickname + '] has been registered as both enlightened and resistance'];
                }

                this.cache[oid] = merge_player.apply(null, data);

                return this.cache[oid];
            },

            getSources: function () {
                return this.sources;
            },
            getSource: function (key) {
                var sources = this.sources,
                    length = sources.length,
                    i;

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
                this.getSources().forEach(function (source) {
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

                if (this.query) {
                    var source,
                        step,
                        length;

                    module.log.log('Updating manifest %s', this.key);
                    this.query.load(function (err, data) {
                        length = data.length;

                        step = function (i, updated) {
                            if (i >= length) {
                                callback(updated);
                                return;
                            }

                            source = self.getSource(data[i].key);
                            if (source === null) {
                                loadSource(data[i], function (err, source) {
                                    if (source) {
                                        module.log.log('Adding new source sheet %s', data[i].key)
                                        self.sources.push(source);
                                        if (err) {
                                            err.forEach(module.log.warn);
                                        }

                                        step(i + 1, true);
                                    } else {
                                        module.log.error('Error occured while adding source');
                                        err.forEach(module.log.error);

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

                return errors;
            },
        }),

        loadSource = function (data, callback) {
            var key = data.key,
                source = new module.spreadsheets.Source(key);
            delete data.key;

            source.load(function (err, players) {
                if (players === null) {
                    callback(err, null);
                    return;
                }

                callback(err, new PlayerSource(key, source, data, players));
            });
        },

        loadManifest = function (key, callback) {
            var manifest = new module.spreadsheets.Manifest(key),
                sources = [];

            manifest.load(function (err, sourcesData) {
                if (sourcesData === null) {
                    callback(err, null);
                    return;
                }

                err = err || [];

                var nbSources = sourcesData.length,
                    step = function (i) {
                        if (i >= nbSources) {
                            callback(
                                err.length > 0 ? err : null,
                                new CombinedPlayerSource(sources, key, manifest)
                            );
                            return;
                        }

                        loadSource(sourcesData[i], function (err2, source) {
                            err = err.concat(err2 || []);

                            if (source === null) {
                                callback(err, null);
                                return;
                            }

                            sources.push(source);

                            step(i + 1);
                        });
                    };

                step(0);
            });
        },

        loadManifests = function (keys, callback) {
            var nbKeys = keys.length,
                sources = [],
                err = [],
                step = function (i) {
                    if (i >= nbKeys) {
                        callback(
                            err.length > 0 ? err : null,
                            new CombinedPlayerSource(sources)
                        );
                        return;
                    }

                    loadManifest(keys[i], function (err2, manifest) {
                        err = err.concat(err2 || []);

                        if (manifest === null) {
                            callback(err, null);
                            return;
                        }
                        sources.push(manifest);

                        step(i + 1);
                    });
                };

            step(0);
        };

    // exported functions
    exports.loadManifests = loadManifests;

})(window.iidentity, window.jQuery);
