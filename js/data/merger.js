/**
 * Merges player data.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module) {
    'use strict';

    var exports = (Object.has(module, 'data') ? module.data : (module.data = {})),

    // variables

        anomalies = [ '13magnus', 'recursion', 'interitus' ],
        validFactions = [ 'enlightened', 'resistance', 'unknown', 'error' ],

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
                if (func(obj[key]) === false) {
                    delete obj[key];
                }
            }
        },

    // validation & merging helpers

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

        helpers = {
            validate: {
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

                    arr.exclude({ faction: 'unknown' }, { faction: 'error' }).each(function (object) {
                        if (Object.has(object, 'faction')) {
                            factions[
                                ('' + object.faction).compact().toLowerCase()
                            ] = true;
                        }
                    });

                    if (Object.size(factions) > 1) {
                        err.push('Player has multiple factions: ' + Object.keys(factions).join(', '));
                        arr.each(function (object) {
                            object.faction = 'error';
                        });
                    }
                },
                checkValidLevel: function (object, err) {
                    if (!Object.has(object, 'level')) {
                        return;
                    }

                    if (!(Object.isString(object.level) || Object.isNumber(object.level))
                            && !('' + object.level).compact().match(/^([0-9]|1[0-6]|\?|)$/)) {
                        err.push('Invalid level: "' + object.level + '"');
                        delete object.level;
                    }
                },
                checkValidFaction: function (object, err) {
                    if (!Object.has(object, 'faction')) {
                        return;
                    }

                    if (validFactions.indexOf(object.faction) === -1) {
                        err.push('Invalid faction: "' + object.faction + '"');
                        delete object.faction;
                    }
                },
            },

            merge: {
                // default merge function
                '.default': function (target, src, key) {
                    target[key] = src[key];
                },

                // merge functions for specific data values
                // for function func, src[func] is bound to exist,
                // there's no guarantee for target[func] unless noted otherwise
                err: function (target, src) {
                    if (!Object.has(target, 'err')) {
                        target.err = [];
                    } else if (!Array.isArray(target, 'err')) {
                        target.err = [ target.err ];
                    }

                    if (Array.isArray(src.err)) {
                        target.err = target.err.concat(src.err);
                    } else {
                        target.err.push(src.err);
                    }
                },
                faction: function (target, src) {
                    if (!Object.has(target, 'faction')
                            || (src.faction !== 'unknown' && target.faction !== 'error')) {
                        target.faction = src.faction;
                    }
                },
                extra: function (target, src) {
                    // target has extra, see merge function
                    var tmp;

                    Object.each(src.extra, function (key, srcValue) {
                        if (Object.has(target.extra, key)) {
                            if (Array.isArray(target.extra[key])) {
                                addToArray(
                                    srcValue,
                                    target.extra[key]
                                );
                            } else if (Object.isBoolean(target.extra[key])) {
                                target.extra[key] = target.extra[key] || (!!srcValue);
                            } else {
                                tmp = [ target.extra[key] ];
                                addToArray(
                                    srcValue,
                                    tmp
                                );

                                if (tmp.length > 1) {
                                    target.extra[key] = tmp;
                                }
                            }
                        } else {
                            target.extra[key] = srcValue;
                        }
                    });
                },
                level: function (target, src) {
                    // target has level, see merge function
                    var level = +src.level;

                    if (isNaN(level)) {
                        return;
                    }

                    level = Number.range(0, 16).clamp(level);

                    if (level > target.level) {
                        target.level = level;
                    }
                }
            },
        },

    // pre-merge validation

        pre_validate = function (arr, err) {
            arr.each(function (object) {
                if (Object.has(object, 'extra')) {
                    helpers.validate.checkValidPage(object.extra, 'event', err);
                    helpers.validate.checkValidPage(object.extra, 'community', err);

                    helpers.validate.checkValidAnomaly(object.extra, 'anomaly', err);
                }

                helpers.validate.checkValidLevel(object, err);
                helpers.validate.checkValidFaction(object, err);
            });

            helpers.validate.checkFactions(arr, err);
        },

    // post-merge validation

        post_validate = function (object, err) {
            helpers.validate.checkExists(object, 'faction', err);
            helpers.validate.checkExists(object, 'level', err);
            helpers.validate.checkExists(object, 'nickname', err);
            helpers.validate.checkExists(object, 'oid', err);
        },

        merge = function () {
            if (arguments.length === 0) {
                return false;
            } else if (arguments.length == 1) {
                return arguments[0];
            }

            var target = arguments[0],
                src = arguments[1],
                newArguments;

            if (!Object.isObject(target.extra)) {
                target.extra = {};
            }
            if (!Object.has(target, 'level')) {
                target.level = 0;
            }

            Object.keys(src).each(function (key) {
                if (Object.has(helpers.merge, key)) {
                    helpers.merge[key](target, src);
                } else {
                    helpers.merge['.default'](target, src, key);
                }
            });

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
