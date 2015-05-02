var ready = require('../ready');

module.exports = {
    resolved: function(value) {
        var defer = ready.defer();
        defer.resolve(value);
        return defer.promise();
    },
    rejected: function(value) {
        var defer = ready.defer();
        defer.reject(value);
        return defer.promise();
    },
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