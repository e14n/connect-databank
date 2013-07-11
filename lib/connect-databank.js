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

        Step(
            function() {
                bank.create("session", sid, sess, this);
            },
            function(err, session) {
                if (err && err.name == "AlreadyExistsError") {
                    bank.update("session", sid, sess, this);
                }  else if (err) {
                    throw err;
                } else {
                    bank.append("sessionlist", "active", sid, this);
                }
            },
            function(err) {
                if (err) {
                    if (store.log) store.log.error(err);
                } else {
                    if (store.log) store.log.info({sid: sid, session: sess}, "Saved session.");
                }
                callback(err);
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
                    if (store.log) store.log.info({sid: sid}, "Destroy for absent object");
                    bank.remove("sessionlist", "active", sid, this);
                } else if (err) {
                    throw err;
                } else {
                    bank.remove("sessionlist", "active", sid, this);
                }
            },
            function(err) {
                if (err && err.name == "NoSuchThingError") {
                    if (store.log) store.log.info({sid: sid}, "Destroy for empty session list");
                    callback(null);
                } else if (err && err.name == "NoSuchItemError") {
                    if (store.log) store.log.info({sid: sid}, "Destroy for item not in list");
                    callback(null);
                } else if (err) {
                    if (store.log) store.log.error(err);
                    callback(err);
                } else {
                    if (store.log) store.log.info({sid: sid}, "Destroy for found object");
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.all = function(callback) {

        var store = this,
            bank = this.bank;

        Step(
            function() {
                bank.read("sessionlist", "active", this);
            },
            function(err, sids) {
                if (err && err.name == "NoSuchThingError") {
                    callback(null, []);
                } else if (err) {
                    throw err;
                } else {
                    bank.readAll("session", sids, this);
                }
            },
            function(err, sessionMap) {
                var sid, sessions = [];
                if (err) {
                    callback(err, null);
                } else {
                    for (sid in sessionMap) {
                        if (sessionMap[sid]) {
                            if (store.isActive(sessionMap[sid])) {
                                sessions.push(sessionMap[sid]);
                            } else {
                                // XXX: GC it here
                            }
                        } else {
                            // XXX: remove it here
                        }
                    }
                    callback(null, sessions);
                }
            }
        );
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
            bank = store.bank;

        Step(
            function() {
                bank.read("sessionlist", "active", this);
            },
            function(err, sids) {
                var i, group = this.group();
                if (err && err.name == "NoSuchThingError") {
                    callback(null);
                } else if (err) {
                    throw err;
                } else {
                    for (i = 0; i < sids.length; i++) {
                        store.destroy(sids[i], group());
                    }
                }
            },
            function(err) {
                callback(err);
            }
        );
    };

    DatabankStore.prototype.cleanup = function(callback) {

        var store = this,
            bank = store.bank,
            q = new Queue(25),
            cleanupSession = function(sid, cb) {
                Step(
                    function() {
                        if (store.log) store.log.info({sid: sid}, "Checking sid.");
                        bank.read("session", sid, this);
                    },
                    function(err, session) {
                        if (err && err.name == "NoSuchThingError") {
                            if (store.log) store.log.info({sid: sid}, "Removing unfound session from sessionlist.");
                            bank.remove("sessionlist", "active", sid, this);
                        } else if (err) {
                            throw err;
                        } else if (store.isActive(session)) {
                            if (store.log) store.log.info({sid: sid}, "Ignoring active session.");
                            this(null);
                        } else {
                            if (store.log) store.log.info({sid: sid}, "Cleaning up inactive session.");
                            store.destroy(sid, this);
                        }
                    },
                    cb
                );
            };

        if (store.log) store.log.info("Starting cleanup.");

        Step(
            function() {
                bank.read("sessionlist", "active", this);
            },
            function(err, sids) {
                var group = this.group();
                if (err && err.name == "NoSuchThingError") {
                    if (store.log) store.log.info("No sessionlist found.");
                    callback(null, []);
                    return;
                } else if (err) {
                    throw err;
                }
                if (store.log) store.log.info({length: sids.length}, "Checking sessions.");
                _.each(sids, function(sid) {
                    q.enqueue(cleanupSession, [sid], group());
                });
            },
            callback
        );
    };

    // A schema, for those who want it

    DatabankStore.schema = {
        session: {
            pkey: "sid"
        },
        sessionlist: {
            pkey: "id"
        }
    };

    return DatabankStore;
};
