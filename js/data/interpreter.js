/**
 * Interpret manifests and sources.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module, $) { // TODO: use filterEmpty! (nu worden lege levels nog geïncluded enzo...)

    var exports = (Object.has(module, 'data') ? module.data : (module.data = {})).interpreter = {},

        standardManifestKeys = [ 'key', 'lastupdated', 'tag', 'faction', 'refresh' ],
        standardSourceKeys = [ 'oid', 'nickname', 'name', 'level' ],

        anomalies = [ '13magnus', 'recursion', 'interitus' ],

        createPageValidator = function (key) {
            return function (value, err) {
                if (value.indexOf(':') === -1) {
                    err.push('Invalid ' + key + ': ' + value);
                    delete data[key];
                }
            };
        },

        filterEmpty = function (obj) {
            return Object.each(obj, function (key, value) {
                if (Object.isObject(value)) {
                    filterEmpty(obj[key]);
                } else if (value === undefined || value === null || ('' + value).isBlank()) {
                    delete obj[key];
                }
            });
        },
        validators = {
            anomaly: function (value, err) {
                value = ('' + value).compact();

                if (anomalies.indexOf(value) === -1) {
                    err.push('Invalid anomaly: ' + value);
                    delete data[key];
                }
            },
            community: createPageValidator('community'),
            event: createPageValidator('event')
        },
        validateObject = function (object, err, validator) {
            if (Object.isFunction(validator)) {
                validator(object, err);
                return;
            } else if (!Object.isObject(validator)) {
                return;
            }

            if (!Object.isObject(object)) {
                // ermh, validator expects object
            }
        }

        /**
         * An instance of ManifestEntry represents one row in a manifest.
         */
        ManifestEntry = Class.extend({
            init: function (data) {
                this.err = [];

                data = filterEmpty(Object.clone(data, true));

                this.manifestData = Object.select(data, standardManifestKeys);
                this.nonManifestData = Object.reject(data, standardManifestKeys);

                this.checkValid();
                // todo: use validators to check extra data
            },
            checkValid: function () {
                if (Object.has(this.nonManifestData, 'extratags')) {
                    // old-school stuff
                    if (!Object.extended(this.nonManifestData).reject('extratags').isEmpty()) {
                        this.err.push('Using old-type extratags combined with extra columns is discouraged.');
                    }
                }
            },
            getExtraData: function () {
                var extratags = null;

                if (Object.has(this.nonManifestData, 'extratags')) {
                    try {
                        extratags = JSON.parse(this.nonManifestData.extratags);
                    } catch (e) {
                        this.err.push('Invalid JSON in extratags: ' + e);
                        extratags = null;
                    }
                }

                if (extratags === null) {
                    return Object.reject(this.nonManifestData, 'extratags');
                } else {
                    // extra columns override extratags
                    return $.extend(
                        true,
                        extratags,
                        Object.reject(this.nonManifestData, 'extratags')
                    );
                }
            },
            getManifestData: function () {
                return this.manifestData;
            },
            getData: function () {
                if (Object.has(this, 'data')) {
                    return this.data;
                }

                return this.data = {
                    faction: this.getFaction(),
                    extra: this.getExtraData()
                };
            },

            /** Gets the player data combined with this manifests data */
            getPlayerData: function (playerData) {
                // data in source override data in manifest
                return $.extend(
                    true,
                    {},
                    this.getData(),
                    filterEmpty(Object.clone(playerData, true))
                );
            },

            getTag: function () {
                return this.getManifestData().tag;
            },
            getVersion: function () {
                return this.getManifestData().lastupdated;
            },
            getFaction: function () {
                return this.getManifestData().faction;
            },

            hasExtra: function (tag, oid) {
                var extra = this.getData().extra,
                    i;

                if (!Object.has(extra, tag) || !Object.isString(extra[tag])) {
                    return false;
                }

                i = extra[tag].indexOf(':');

                return (i !== -1) && (oid === extra[tag].to(i).compact());
            },

            getErr: function () {
                return this.err;
            }
        }),

        readSource = function (data) {
            var result = Object.select(data, standardSourceKeys, 'faction');
            result.extra = Object.reject(data, standardSourceKeys, 'faction');

            return result;
        };

    exports.interpretManifestEntry = function (data) {
        return new ManifestEntry(data);
    };

    exports.interpretSourceEntry = function (manifestEntry, data) {
        return manifestEntry.getPlayerData(
            readSource(data)
        );
    };

})(window.iidentity, window.jQuery);
