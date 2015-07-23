var ready = require('../ready');

module.exports = {
    resolved: ready.resolve.bind(ready),
    rejected: ready.reject.bind(ready),
    deferred: function() {
        var defer = ready.defer();
        return {
            promise : defer.promise(),

            resolve : function(val) {
                defer.resolve(val);
            },

            reject : function(reason) {
                defer.reject(reason);
            }
        };
    }
};