## Ready

Ready is a Promises/A+ implementation with supporting ES6 Promises specification.

[Promises/A+ specification](https://promisesaplus.com/)


### Installing

#### Node.js

Using npm:

```
npm install ready-promises
```

#### Browsers

Using bower:

```
bower install ready-promises
```

Using script tag:

```
<script type="text/javascript" src="ready.min.js"></script>
```

### Simple usage

#### Using a deferred

```
var async = function() {
    // create a deferred
    var defer = ready.defer();

    // resolve or reject deferred
    // for example defer.resolve('dummy');

    return defer.promise();
}

async().then(
    function onResolve() {},
    function onReject() {}
);


```

In this case deferred object contains methods to resolve and reject promise and promise object allow to subscribe on reject and resolve actions

#### Using ES6 way


```
var async = function() {
    return new ready.Promise(function(resolve, reject) {
        // you can call resolve or reject callbacks here
    });
}

async().then(
    function onResolve() {},
    function onReject() {}
);

```

## Description

### ready methods

```Promise(onResolve, onReject)``` - es6-compatible way to create a promise.

```defer()``` - method to create deferred object.

```Deferred()``` - constructor to create deferred object.

```all(iterable)``` - returns a promise that resolves when all of the promises in the iterable argument have resolved.

```race(iterable)``` - returns a promise that resolves or rejects as soon as one of the promises in the iterable resolves or rejects, with the value or reason from that promise.

```any(iterable)``` - returns first successful promise or returns a promise that rejected when all of the promises in the iterable argument have rejected.

```reject(reason)``` - returns a Promise object that is rejected with the given reason.

```resolve(value)``` - returns a Promise object that is resolved with the given value.

```denodeify(fn, argumentCount)``` - add a callback to any calls to the function, and use that to fullfill or reject the promise.


### Deferred object methods

There are two possible ways to create a deferred.

1. Using method - ```var defer = reade.defer()```

2. Using constructor - ```var defer = new ready.Deferred()```

Deferred object has 3 methods:

```promise``` - return promise from deferred.

```resolve``` - resolve promise with value

```reject``` - reject promise with reason

### Promise object methods

```then``` - add resolve and reject callbacks

```done``` - add resolve callback

```fail``` - add reject callback

```catch``` - add reject callback

```nodeify``` - convert promised code to use node style callbacks. If no callback is provided it will just return the original promise.


