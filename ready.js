(function(global) {
    'use strict';

    var NONE;
    var STATUS = {
        PENDING: 0,
        FULFILLED: 1,
        REJECTED: 2
    };
    var READY_PROMISE = '__ReadyPromise__';

    var asyncCall = (function() {
        var list = [];
        var addFunction = function(fn) {
            return list.push(fn) - 1;
        };
        var callList = function() {
            var store = list;
            var length = store.length;
            var i = 0;
            list = [];

            while (i < length) {
                store[i++]();
            }
        };

        // ie10, nodejs >= 0.10
        if (typeof setImmediate === 'function') {
            return function(fn) {
                addFunction(fn) || setImmediate(callList);
            };
        }

        // nodejs < 0.10
        if (typeof process === 'object' && process.nextTick) {
            return function(fn) {
                addFunction(fn) || process.nextTick(callList);
            };
        }

        // Async postMessage checking from https://github.com/YuzuJS/setImmediate
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage('', '*');
            global.onmessage = oldOnMessage;

            if (postMessageIsAsynchronous) {
                var messageFlag = '__ready__' + new Date().getTime();
                var processMessage = function(e) {
                    if (e.data !== messageFlag) {
                        return;
                    }
                    // check stopPropagation access
                    // https://developer.mozilla.org/ru/docs/Web/API/event/stopPropagation
                    e.stopPropagation && e.stopPropagation();

                    callList();
                };

                if (global.addEventListener) {
                    global.addEventListener('message', processMessage, true);
                } else {
                    global.attachEvent('onmessage', processMessage);
                }

                return function(fn) {
                    addFunction(fn) || global.postMessage(messageFlag, '*');
                };
            }
        }

        return function(fn) {
            addFunction(fn) || setTimeout(callList, 0);
        };

    })();

    /**
     * Promises/A+ implementation
     * @constructor
     */
    function Promise(executor) {
        this._value = NONE;
        this._status = STATUS.PENDING;
        this._type = READY_PROMISE;
        this._resolveStack = [];
        this._rejectStack = [];

        if (typeof executor === 'function') {
            var self = this;
            executor(
                function(value) {
                    self._resolve(value);
                },
                function(value) {
                    self._reject(value);
                }
            );
        }
    }

    Promise.prototype = {
        _addCallbacks: function(onFulFilled, onRejected) {
            var defer = new Deffered();
            // inline code for better performance
            // fulfill
            var FulFilled = {
                callback: typeof onFulFilled === 'function' ? onFulFilled : NONE,
                readyDefer: defer
            };

            if (this._status === STATUS.FULFILLED) {
                this._callCallbacks([FulFilled], this._value);
                return defer.promise();
            }

            this._resolveStack.push(FulFilled);

            // reject
            var rejected = {
                callback: typeof onRejected === 'function' ? onRejected : NONE,
                readyDefer: defer
            };

            if (this._status === STATUS.REJECTED) {
                this._callCallbacks([rejected], this._value);
                return defer.promise();
            }

            this._rejectStack.push(rejected);

            return defer.promise();
        },

        then: function(onFulFilled, onRejected) {
            return this._addCallbacks(onFulFilled, onRejected);
        },

        done: function(onFulFilled) {
            return this._addCallbacks(onFulFilled);
        },

        fail: function(onRejected) {
            return this._addCallbacks(NONE, onRejected);
        },

        'catch': function(onRejected) {
            return this._addCallbacks(NONE, onRejected);
        },

        nodeify: function(callback, ctx) {
            if (typeof callback !== 'function') {
                return this;
            }

            this.then(function(value) {
                callback.call(ctx, null, value);
            }, function(reason) {
                callback.call(ctx, reason);
            });
        },

        _resolve: function(value) {
            if (this._status > 0) {
                return;
            }

            if (value === this) {
                this._reject(new TypeError('Can\'t resolve promise with itself'));
            }

            if (value && (typeof value === 'object' || typeof value === 'function')) {

                // check value is ready promise
                if (value._type && value._type === READY_PROMISE) {
                    if (value._status === STATUS.FULFILLED) {
                        this._resolve(value._value);
                    } else if (value._status === STATUS.REJECTED) {
                        this._reject(value._value);
                    } else {
                        value.then(this._resolve.bind(this), this._reject.bind(this));
                    }
                    return;
                }

                // check to value === null
                var then;
                try {
                    then = value.then;
                } catch (e) {
                    this._reject(e);
                    return;
                }
                if (typeof then === 'function') {
                    var self = this;
                    var isResolving = false;
                    try {
                        then.call(
                            value,
                            function(value) {
                                if (isResolving) {
                                    return;
                                }

                                isResolving = true;
                                self._resolve(value);
                            },
                            function(reason) {
                                if (isResolving) {
                                    return;
                                }

                                isResolving = true;
                                self._reject(reason);
                            });
                    } catch (e) {
                        if (!isResolving) {
                            this._reject(e);
                        }
                    }
                    return;
                }
            }

            this._value = value;
            this._status = STATUS.FULFILLED;
            this._callCallbacks(this._resolveStack, value);

            this._resolveStack = [];
            this._rejectStack = [];
        },

        _reject: function(reason) {
            if (this._status > 0) {
                return;
            }

            this._value = reason;
            this._status = STATUS.REJECTED;
            this._callCallbacks(this._rejectStack, reason);

            this._resolveStack = [];
            this._rejectStack = [];
        },

        _callCallbacks: function(callbacks, value) {
            var processFunction = function(callbackObj) {
                var res = value;
                if (callbackObj.callback) {
                    try {
                        var callback = callbackObj.callback;
                        res = callback(value);
                    } catch (e) {
                        callbackObj.readyDefer.reject(e);
                        return;
                    }
                } else {
                    callbackObj.readyDefer[method](res);
                    return;
                }
                callbackObj.readyDefer.resolve(res);
            };

            var method = this._status === STATUS.FULFILLED ? 'resolve' : 'reject';

            if (callbacks && callbacks.length) {
                asyncCall(function() {
                    var length = callbacks.length;
                    for (var i = 0; i < length; i++) {
                        processFunction(callbacks[i]);
                    }
                });
            }
        },

        constructor: Promise
    };

    function Deffered() {
        this._promise = new Promise();
    }

    Deffered.prototype = {
        promise: function() {
            return this._promise;
        },

        resolve: function(value) {
            this._promise._resolve(value);
        },

        reject: function(value) {
            this._promise._reject(value);
        },

        constructor: Deffered
    };

    var ready = {

        Promise: Promise,

        Deffered: Deffered,

        defer: function() {
            return new Deffered();
        },

        all: function(iterable) {
            var processPromise = function(i) {
                iterable[i].then(function(value) {
                    result[i] = value;
                    all--;
                    if (all === 0) {
                        defer.resolve(result);
                    }
                }, function(reason) {
                    defer.reject(reason);
                });
            };
            var all = 0;
            var result = [];
            var defer = new Deffered();
            for (var i in iterable) {
                all++;
                processPromise(i);
            }
            return defer.promise();
        },

        race: function(iterable) {
            var processPromise = function(i) {
                iterable[i].then(function(value) {
                    defer.resolve(value);
                }, function(reason) {
                    defer.reject(reason);
                });
            };
            var defer = new Deffered();
            for (var i in iterable) {
                processPromise(i);
            }
            return defer.promise();
        },

        spead: function() {
            var addCallbacks = function(promise, i) {
                promise.then(function(value) {
                    result[i] = value;
                    all--;
                    if (all === 0) {
                        defer.resolve(result);
                    }
                }, function(reason) {
                    defer.reject(reason);
                });
            };

            var all = 0;
            var result = [];
            var defer = new Deffered();
            for (var i = 0, l = arguments.length; i < l; i++) {
                all++;
                addCallbacks(arguments[i], i);
            }
            return defer.promise();
        },

        any: function(iterable) {
            var all = 0;
            var reasons = [];
            var defer = new Deffered();
            for (var i in iterable) {
                all++;
                (function(i) {
                    iterable[i].then(function(value) {
                        var result = {};
                        result[i] = value;
                        defer.resolve(result);
                    }, function(reason) {
                        reasons[i] = reason;
                        all--;
                        if (all === 0) {
                            defer.reject(reasons);
                        }
                    });
                })(i);
            }
            return defer.promise();
        },

        resolve: function(value) {
            var defer = new Deffered();
            defer.resolve(value);
            return defer.promise();
        },

        reject: function(reason) {
            var defer = new Deffered();
            defer.reject(reason);
            return defer.promise();
        },

        denodeify: function(fn, argumentCount) {
            argumentCount = argumentCount || Infinity;
            return function () {
                var self = this;
                var args = Array.prototype.slice.call(arguments);
                var defer = this.defer();
                while (args.length && args.length > argumentCount) {
                    args.pop();
                }
                args.push(function (err, res) {
                    if (err) {
                        defer.reject(err);
                    } else {
                        defer.resolve(res);
                    }
                });
                var res = fn.apply(self, args);

                if (res && (typeof res === 'object' || typeof res === 'function') && typeof res.then === 'function') {
                    defer.resolve(res);
                }

                return defer.promise();
            };
        }
    };

    (function(ready) {
        if (typeof define === 'function' && define.amd) {
            // AMD.
            define(ready);
        } else if (typeof exports === 'object') {
            // CommonJS
            module.exports = ready;
        } else {
            // Глобальный scope
            global.ready = ready;
        }
    })(ready);
})(this);
