// connect-databank.js
//
// Store connect session in a databank
//
// Copyright 2012-2013 E14N Inc. http://e14n.com/
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var _ = require("underscore"),
    Step = require("step"),
    Queue = require("jankyqueue");

module.exports = function(connect) {

    var Store = connect.session.Store;

    var DatabankStore = function(bank, log, cleanup) {
        var store = this;
        store.bank = bank;
        if (log) {
            store.log = log.child({component: "connect-databank"});
        }
        if (cleanup) {
            store.interval = setInterval(function() {
                store.cleanup(function(err) {
                    if (err) {
                        if (store.log) store.log.error(err, "Error cleaning up sessions");
                    } else {
                        if (store.log) store.log.info("Finished cleaning up sessions.");
                    }
                });
            }, cleanup);
        }
    };

    // This is weird

    DatabankStore.prototype.__proto__ = Store.prototype;

    DatabankStore.prototype.isActive = function(session) {

        var expires;

        if ('string' == typeof session.cookie.expires) {
            expires = new Date(session.cookie.expires);
        } else {
            expires = session.cookie.expires;
        }
        
        if (!expires || Date.now() < expires) {
            return true;
        } else {
            return false;
        }
    };

    DatabankStore.prototype.get = function(sid, callback) {

        var store = this,
            bank = this.bank;

        Step(
            function() {
                bank.read("session", sid, this);
            },
            function(err, session) {
                if (err && err.name == "NoSuchThingError") {
                    if (store.log) store.log.info({sid: sid, session: null}, "No session");
                    callback(null, null);
                } else if (err) {
                    throw err;
                } else if (store.isActive(session)) {
                    if (store.log) store.log.info({sid: sid, session: session}, "Got session");
                    callback(null, session);
                } else {
                    if (store.log) store.log.info({sid: sid, session: session}, "Inactive session; destroying.");
                    store.destroy(sid, this);
                }
            },
            function(err) {
                if (err) {
                    if (store.log) store.log.error(err);
                    callback(err, null);
                } else {
                    if (store.log) store.log.info({sid: sid}, "Inactive session; destroyed.");
                    callback(null, null);
                }
            }
        );
    };

    DatabankStore.prototype.set = function(sid, sess, callback) {

        var store = this,
            bank = this.bank,
            sval = _.extend({sid: sid}, sess);

        Step(
            function() {
                bank.save("session", sid, sval, this);
            },
            function(err, saved) {
                if (err) {
                    if (store.log) store.log.error(err);
                    callback(err);
                } else {
                    if (store.log) store.log.info({sid: sid, session: saved}, "Saved session.");
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.destroy = function(sid, callback) {
        var store = this,
            bank = this.bank;

        bank.del("session", sid, function(err) {
            if (err && err.name == "NoSuchThingError") {
                if (store.log) store.log.info({sid: sid}, "Destroy for empty session list");
                callback(null);
            } else if (err) {
                if (store.log) store.log.error(err);
                callback(err);
            } else {
                if (store.log) store.log.info({sid: sid}, "Destroy for found object");
                callback(null);
            }
        });
    };

    DatabankStore.prototype.all = function(callback) {

        var store = this,
            bank = this.bank,
            results = [];

        bank.scan("session", 
                  function(value) { 
                      if (store.isActive(value)) { 
                          results.push(value);
                      }
                  },
                  function(err) {
                      if (err) {
                          callback(err, null);
                      } else {
                          callback(null, results);
                      }
                  });
    };

    DatabankStore.prototype.length = function(callback) {
        var store = this,
            bank = store.bank;

        Step(
            function() {
                store.all(this);
            },
            function(err, sessions) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, sessions.length);
                }
            }
        );
    };

    DatabankStore.prototype.clear = function(callback) {
        var store = this,
            bank = store.bank,
            sids = [];

        Step(
            function() {
                var cb = this,
                    sids = [];
                bank.scan("session", 
                          function(value) { 
                              console.log(value.sid);
                              sids.push(value.sid);
                          },
                          function(err) {
                              if (err) throw err;
                              cb(null, sids);
                          });
            },
            function(err, sids) {
                var group = this.group();
                if (err) throw err;
                _.each(sids, function(sid) {
                    bank.del("session", sid, group());
                });
            },
            function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.cleanup = function(callback) {

        var store = this,
            bank = store.bank,
            q = new Queue(25),
            cleanupSession = function(session) {
                if (store.isActive(session)) {
                    if (store.log) store.log.info({sid: session.sid}, "Ignoring active session.");
                } else {
                    if (store.log) store.log.info({sid: session.sid}, "Cleaning up inactive session.");
                    bank.del("session", session.sid, function(err) {
                        if (store.log) {
                            if (err) {
                                store.log.error(err);
                            } else {
                                store.log.info({sid: session.sid}, "Deleted session");
                            }
                        }
                    });
                }
            };

        if (store.log) store.log.info("Starting cleanup.");

        bank.scan("session", cleanupSession, callback);
    };

    // A schema, for those who want it

    DatabankStore.schema = {
        session: {
            pkey: "sid"
        }
    };

    return DatabankStore;
};
