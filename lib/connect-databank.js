// connect-databank.js
//
// Store connect session in a databank
//
// Copyright 2012 StatusNet Inc.
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

var Step = require("step");

module.exports = function(connect) {

    var Store = connect.session.Store;

    var dummy = {
	fatal: function() {},
	error: function() {},
	warn: function() {},
	info: function() {},
	debug: function() {},
	trace: function() {},
	child: function() { return this; }
    };
    
    var DatabankStore = function(bank, log) {
        this.bank = bank;
	if (log) {
	    this.log = log.child({component: "connect-databank"});
	} else {
	    this.log = dummy;
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
		    store.log.info({sid: sid, session: null}, "No session");
                    callback(null, null);
                } else if (err) {
                    throw err;
                } else if (store.isActive(session)) {
		    store.log.info({sid: sid, session: session}, "Got session");
                    callback(null, session);
                } else {
                    store.destroy(sid, this);
                }
            },
            function(err) {
		if (err) {
		    store.log.error(err);
		}
                callback(err);
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
            function(err, res) {
		if (err) {
		    store.log.error(err);
		} else {
		    store.log.info({sid: sid, session: sess}, "Saved session.");
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
		    store.log.info({sid: sid}, "Destroy for absent object");
                    callback(null);
                } else if (err) {
                    throw err;
                } else {
                    bank.remove("sessionlist", "active", sid, this);
                }
            },
            function(err) {
                if (err && err.name == "NoSuchItemError") {
		    store.log.info({sid: sid}, "Destroy for item not in list");
                    callback(null);
                } else if (err) {
		    store.log.error(err);
                    callback(err);
                } else {
		    store.log.info({sid: sid}, "Destroy for found object");
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

    return DatabankStore;
};
