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
            setTimeout(function() {
                store.interval = setInterval(function() {
                    store.cleanup(function(err) {
                        if (err) {
                            if (store.log) store.log.error(err, "Error cleaning up sessions");
                        } else {
                            if (store.log) store.log.info("Finished cleaning up sessions.");
                        }
                    });
                }, cleanup);
            }, Math.floor(Math.random()*cleanup));
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
            bank = this.bank;

        // connect sets this... usually.

        if (!_.has(sess, "sid")) {
            sess.sid = sid;
        }

        Step(
            function() {
                bank.save("session", sid, sess, this);
            },
            function(err, saved) {
                if (err) {
                    if (store.log) store.log.error(err);
                    callback(err);
                } else {
                    if (store.log) store.log.info({sid: sid, session: sess}, "Saved session.");
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.destroy = function(sid, callback) {
        var store = this,
            bank = this.bank;

        Step(
            function() {
                bank.del("session", sid, this);
            },
            function(err) {
                if (err && err.name == "NoSuchThingError") {
                    if (store.log) store.log.info({sid: sid}, "Destroy for non-existent session; all good.");
                    callback(null);
                } else if (err) {
                    if (store.log) store.log.error(err);
                    callback(err);
                } else {
                    if (store.log) store.log.info({sid: sid}, "Destroy for found session");
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.all = function(callback) {

        var store = this,
            bank = this.bank,
            sessions = [];

        Step(
            function() {
                var keepActive = function(session) {
                    if (store.isActive(session)) {
                        sessions.push(session);
                    }
                };
                bank.scan("session", keepActive, this);
            },
            function(err) {
                if (err) {
                    if (store.log) store.log.error(err);
                    callback(err, null);
                } else {
                    if (store.log) store.log.info({count: sessions.length}, "Retrieved all sessions");
                    callback(null, sessions);
                }
            }
        );
    };

    DatabankStore.prototype.length = function(callback) {
        var store = this,
            bank = store.bank,
            lng = 0;

        Step(
            function() {
                bank.scan("session", function(session) { lng++; }, this);
            },
            function(err) {
                if (err) {
                    if (store.log) store.log.error(err);
                    callback(err, null);
                } else {
                    if (store.log) store.log.info({length: lng}, "Retrieved count of sessions");
                    callback(null, lng);
                }
            }
        );
    };

    DatabankStore.prototype.clear = function(callback) {

        var store = this,
            bank = this.bank,
            sids = [];

        Step(
            function() {
                bank.scan("session", function(session) { sids.push(session.sid); }, this);
            },
            function(err) {
                var i, group = this.group();
                if (err) throw err;
                _.each(sids, function(sid) {
                    // XXX: maybe don't abort if some session won't delete
                    bank.del("session", sid, group());
                });
            },
            function(err) {
                if (err) {
                    if (store.log) store.log.error(err);
                    callback(err);
                } else {
                    if (store.log) store.log.info("Cleared all sessions.");
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.cleanup = function(callback) {

        var store = this,
            bank = store.bank,
            toDel = [],
            q = new Queue(25),
            cleanupSession = function(sid, callback) {
                bank.del("session", sid, function(err) {
                    if (err && err.name == "NoSuchThingError") {
                        // We don't care.
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            };

        if (store.log) store.log.info("Starting cleanup.");

        Step(
            function() {
                var check = function(session) {
                        if (store.isActive(session)) {
                            if (store.log) store.log.info({sid: session.sid}, "Ignoring active session.");
                        } else {
                            if (store.log) store.log.info({sid: session.sid}, "Queuing inactive session for cleanup.");
                            toDel.push(session.sid);
                        }
                    };
                bank.scan("session", check, this);
            },
            function(err) {
                var group = this.group();
                if (err) throw err;
                if (store.log) store.log.info({count: toDel.length}, "Deleting inactive sessions.");
                _.each(toDel, function(sid) {
                    q.enqueue(cleanupSession, [sid], group());
                });
            },
            function(err) {
                if (err) {
                    if (store.log) store.log.error(err, "Error cleaning up sessions");
                    callback(err);
                } else {
                    if (store.log) store.log.info("Cleanup complete");
                    callback(null);
                }
            }
        );
    };

    // A schema, for those who want it

    DatabankStore.schema = {
        session: {
            pkey: "sid"
        }
    };

    return DatabankStore;
};
