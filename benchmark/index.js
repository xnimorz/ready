// Test cases based on vow benchmark - https://github.com/dfilatov/vow

var cliff = require('cliff');
var benchmark = require('benchmark');
var data = require('./data');
var Vow = require('vow');
var Q = require('q');
var When = require('when');
var Bluebird = require('bluebird');
var Pinkie = require('pinkie-promise');
var ready = require('../ready');
var es6Promise = require('es6-promise').Promise;

function deferTest(promiseObject, isFunction) {
    return function (deferred) {
        var toResolve = [];
        var topPromises = [];

        Object.keys(data).forEach(function(key) {
            var defer = promiseObject.defer();
            promiseObject.all(data[key].map(function (val) {
                var defer = promiseObject.defer();
                toResolve.push({defer: defer, val: val});
                if (isFunction) {
                    return defer.promise();
                }
                return defer.promise;
            }))
                .then(function (val) {
                    defer.resolve(val);
                });
            topPromises.push(isFunction ? defer.promise() : defer.promise);
        });

        promiseObject.all(topPromises).then(function () {
            deferred.resolve();
        });

        toResolve.forEach(function (obj) {
            obj.defer.resolve(obj.val);
        });
    }
}

function es6Test(constructor) {
    return function(deferred) {
        var toResolve = [];
        var topPromises = [];

        Object.keys(data).forEach(function(key) {
            var resolve;
            var promise = new constructor(function(_resolve) {
                resolve = _resolve;
            });
            constructor.all(data[key].map(function (val) {
                return new constructor(function(_resolve) {
                    toResolve.push({ resolve : _resolve, val : val });
                });
            }))
                .then(function (val) {
                    resolve(val);
                });
            topPromises.push(promise);
        });

        constructor.all(topPromises).then(function () {
            deferred.resolve();
        });

        toResolve.forEach(function (obj) {
            obj.resolve(obj.val);
        });
    }
}

var tests = {
        'Q' : deferTest(Q),

        'When': deferTest(When),

        'Bluebird' : es6Test(Bluebird),

        'Pinkie' : es6Test(Pinkie),

        'ES2015 Promise' : es6Test(Promise),

        'es6Promise': es6Test(es6Promise),

        'Vow' : es6Test(Vow.Promise),

        'VowDefer' : deferTest(Vow, true),

        'ready': es6Test(ready.Promise),

        'readyDefer': deferTest(ready, true)
    },
    results = [],
    onTestCompleted = function(name) {
        results.push({
            ''          : name,
            'mean time' : (this.stats.mean * 1000).toFixed(3) + 'ms',
            'ops/sec'   : (1 / this.stats.mean).toFixed(0)
        });
    };

var suite = new benchmark.Suite(
    'comparison',
    {
        onStart : function() {
            console.log('Starts\n');
        },

        onComplete : function() {
            console.log(cliff.stringifyObjectRows(
                    results,
                    ['', 'mean time', 'ops/sec'],
                    ['red', 'green', 'blue']) + '\n');
            results = [];
        }
    });

Object.keys(tests).forEach(function(name) {
    var i = 0;
    suite.add(
        name,
        function(deferred) {
            tests[name](deferred);
        },
        {
            defer      : true,
            onComplete : function() {
                console.log('');
                onTestCompleted.call(this, name);
            }
        });
});

suite.run();