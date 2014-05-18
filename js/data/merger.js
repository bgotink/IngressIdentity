/**
 * Merges player data.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module) {

    var exports = (Object.has(module, 'data') ? module.data : (module.data = {})),

    // variables

        anomalies = [ '13magnus', 'recursion', 'interitus' ],

    // general helpers

        doEach = function (obj, key, func) {
            if (!Object.has(obj, key)) {
                return;
            }

            if (Array.isArray(obj[key])) {
                obj[key].each(function (e) {
                    if (func(e) === false) {
                        obj[key].remove(e);
                    }
                });
            } else {
                if (func(obj[key] === false) {
                    delete obj[key];
                }
            }
        },

    // validation helpers

        helpers = {
            checkExists: function (obj, key, err) {
                if (!Object.has(obj, key)) {
                    err.push('Expected key "' + key + '" to exist.');
                }
            },
            checkValidPage: function (obj, key, err) {
                doEach(obj, key, function (value) {
                    if (!Object.isString(value) || value.indexOf(':') === -1) {
                        err.push('Invalid ' + key + ': "' + value + '"');
                        return false;
                    }
                });
            },
            checkValidAnomaly: function (obj, key, err) {
                doEach(obj, key, function (value) {
                    if (!Object.isString(value) || anomalies.indexOf(
                                value.compact().toLowerCase()
                            ) === -1) {
                        err.push('Invalid anomaly: "' + value + '"');
                        return false;
                    }
                });
            },
            checkFactions: function (arr, err) {
                if (arr.length === 0) {
                    return;
                }

                var factions = {};

                arr.each(function (object) {
                    if (Object.has(object, 'faction')) {
                        factions[
                            ('' + object.faction).compact().toLowerCase()
                        ] = true;
                    }
                });

                if (factions.length > 1) {
                    err.push('Player has multiple factions: ' + Object.keys(factions).join(', '));
                }
            }
        },

    // pre-merge validation

        pre_validate = function (arr, err) {
            arr.each(function (object) {
                if (Object.has(object, 'extra')) {
                    helpers.checkValidPage(object.extra, 'event', err);
                    helpers.checkValidPage(object.extra, 'community', err);

                    helpers.checkValidAnomaly(object.extra, 'anomaly', err);
                }
            });

            helpers.checkFactions(arr, err);
        },

    // post-merge validation

        post_validate = function (object, err) {
            helpers.checkExists(object, 'faction', err);
            helpers.checkExists(object, 'level', err);
            helpers.checkExists(object, 'nickname', err);
            helpers.checkExists(object, 'oid', err);
        },

    // merge helpers

        getExtraDataValueName = function (str) {
            var i = str.indexOf(':');

            if (i === -1) {
                return str.compact().toLowerCase();
            } else {
                return str.to(i).compact().toLowerCase();
            }
        },

        addToArray = function (src, dst) {
            if (!Array.isArray(src)) {
                src = [ src ];
            }

            var existing = [],
                name;

            dst.each(function (elem) {
                existing.push(getExtraDataValueName(elem));
            });

            src.each(function (elem) {
                name = getExtraDataValueName(elem);

                if (existing.indexOf(name) === -1) {
                    dst.push(elem);
                    existing.push(name);
                }
            });
        },

        merge = function () {
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

            if (!Object.isObject(target.extra)) {
                target.extra = {};
            }

            for (key in src) {
                if (key === 'err') {
                    if (Array.isArray(src.err)) {
                        if (Object.has(target, 'err')) {
                            if (Array.isArray(target.err)) {
                                target.err = target.err.concat(src.err);
                            } else {
                                target.err = src.err;
                            }
                        } else {
                            target.err = src.err;
                        }
                    }
                } else if (key === 'extra') {
                    for (extraKey in src.extra) {
                        if (Object.has(target.extra, extraKey)) {
                            if (Array.isArray(target.extra[extraKey])) {
                                addToArray(
                                    src.extra[extraKey],
                                    target.extra[extraKey]
                                );
                            } else if (Object.isBoolean(target.extra[extraKey])) {
                                target.extra[extraKey] = target.extra[extraKey] || src.extra[extraKey];
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
            return merge.apply(null, newArguments);
        };

    exports.merge = function (arr, err) {
        var result;

        pre_validate(arr, err);
        result = merge.apply(null, arr);

        return result;
    }

    exports.merge.validate = function (obj, err) {
        post_validate(obj, err);
    }

})(window.iidentity);
