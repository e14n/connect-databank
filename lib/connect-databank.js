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
                bank.scan("session", function(session) { sessions.push(session); }, this);
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
            q = new Queue(25),
            cleanupSession = function(session, cb) {
                if (store.isActive(session)) {
                    if (store.log) store.log.info({sid: session.sid}, "Ignoring active session.");
                    cb(null);
                } else {
                    if (store.log) store.log.info({sid: session.sid}, "Cleaning up inactive session.");
                    bank.del("session", session.sid, cb);
                }
            };

        if (store.log) store.log.info("Starting cleanup.");

        Step(
            function() {
                store.all(this);
            },
            function(err, sessions) {
                var group = this.group();
                if (err) throw err;
                if (store.log) store.log.info({length: sessions.length}, "Checking sessions.");
                _.each(sessions, function(session) {
                    q.enqueue(cleanupSession, [session], group());
                });
            },
            callback
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
