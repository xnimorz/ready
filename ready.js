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

        if (typeof executor === 'function') {
            var self = this;
            executor(
                function(value) {
                    self.resolve(value);
                },
                function(value) {
                    self.reject(value);
                },
                function(value) {
                    self.notify(value);
                }
            );
        }
    }

    Promise.prototype = {
        _addCallbacks: function(onFulFilled, onRejected, onMessage) {
            var defer = new Deffered();
            // inline code for better performance
            // fulfill
            var FulFilled = {
                callback: typeof onFulFilled === 'function' ? onFulFilled : NONE,
                readyDefer: defer
            };

            if (this._status === STATUS.FULFILLED) {
                this._callCallbacks(FulFilled, this._value);
                return defer.promise();
            }

            if (!this._resolveStack) {
                this._resolveStack = FulFilled;
            } else {
                if (!this._resolveStack.length) {
                    this._resolveStack = [this._resolveStack];
                }
                this._resolveStack.push(FulFilled);
            }

            // reject
            var rejected = {
                callback: typeof onRejected === 'function' ? onRejected : NONE,
                readyDefer: defer
            };

            if (this._status === STATUS.REJECTED) {
                this._callCallbacks(rejected, this._value);
                return defer.promise();
            }

            if (!this._rejectStack) {
                this._rejectStack = rejected;
            } else {
                if (!this._rejectStack.length) {
                    this._rejectStack = [this._rejectStack];
                }
                this._rejectStack.push(rejected);
            }

            // message

            var message = {
                callback: typeof onMessage === 'function' ? onMessage : NONE,
                readyDefer: defer
            };

            if (!this._onMessage) {
                this._messageStack = message;
            } else {
                if (!this._messageStack.length) {
                    this._messageStack = [this._messageStack];
                }
                this._messageStack.push(message);
            }

            return defer.promise();
        },

        then: function(onFulFilled, onRejected, onMessage) {
            return this._addCallbacks(onFulFilled, onRejected, onMessage);
        },

        done: function(onFulFilled) {
            return this._addCallbacks(onFulFilled);
        },

        fail: function(onRejected) {
            return this._addCallbacks(NONE, onRejected);
        },

        notify: function(onMessage) {
            return this._addCallbacks(NONE, NONE, onMessage);
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

            this._resolveStack = NONE;
            this._rejectStack = NONE;
        },

        _reject: function(reason) {
            if (this._status > 0) {
                return;
            }

            this._value = reason;
            this._status = STATUS.REJECTED;
            this._callCallbacks(this._rejectStack, reason);

            this._resolveStack = NONE;
            this._rejectStack = NONE;
        },

        _notify: function(value) {
            this._callCallbacks(this._messageStack, value);
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
                }
                callbackObj.readyDefer.resolve(res);
            };

            var method = this._status === STATUS.FULFILLED ? 'resolve' : 'reject';

            if (callbacks) {
                asyncCall(function() {
                    if (!callbacks.length) {
                        processFunction(callbacks);
                        return;
                    }

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

        notify: function(value) {
            this._promise._notify(value);
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
            var all = 0;
            var result = [];
            var defer = new Deffered();
            for (var i in iterable) {
                all++;
                (function(i) {
                    iterable[i].then(function(value) {
                        result[i] = value;
                        all--;
                        if (all === 0) {
                            defer.resolve(result);
                        }
                    }, function(reason) {
                        defer.reject(reason);
                    });
                })(i);
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

        resolved: function(value) {
            var defer = new Deffered();
            defer.resolve(value);
            return defer.promise();
        },

        rejected: function(reason) {
            var defer = new Deffered();
            defer.reject(reason);
            return defer.promise();
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
