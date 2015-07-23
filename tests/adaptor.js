var ready = require('../ready');

module.exports = {
    resolved: ready.resolved.bind(ready),
    rejected: ready.rejected.bind(ready),
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