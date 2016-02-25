// module-test.js
//
// Test that the module works correctly with a lot of data
//
// Copyright 201e, E14N Inc.
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    Databank = databank.Databank;

var makeStore = function(DatabankStore) {
    var callback = this.callback,
        db = Databank.get("memory", {});

    db.session({}, function(err) {
        var store;
        if (err) {
            callback(err, null);
        } else {
            try {
                store = new DatabankStore(db);
                callback(null, store);
            } catch (e) {
                callback(e, null);
            }
        }
    });
};

var suite = vows.describe("store scaling interface");

suite.addBatch({
    "when we require the connect-databank module": {
        topic: function() {
            return require("../lib/connect-databank");
        },
        "it works": function(middleware) {
            assert.isFunction(middleware);
        },
        "and we apply it to the session module": {
            topic: function(middleware) {
                var session = require("express-session");
                return middleware(session);
            },
            "it works": function(DatabankStore) {
                assert.isFunction(DatabankStore);
            },
            "and we instantiate a store": {
                topic: makeStore,
                "it works": function(err, store, DatabankStore) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
                "and we set() and get() a lot of sessions asynchronously": {
                    topic: function(store) {
                        var callback = this.callback,
                            i,
                            j,
                            k,
                            MAXSESSIONS = 10000,
                            MAXACTIONS = 100000;

                        Step(
                            function() {
                                var group = this.group();
                                for (i = 0; i < MAXSESSIONS; i++) {
                                    store.set("VALID"+i, {cookie: {expires: false}, name: "User"+i, sid: "VALID"+i}, group());
                                }
                            },
                            function(err) {
                                var group = this.group();
                                if (err) throw err;
                                for (i = 0; i < MAXACTIONS; i++) {
                                    k = Math.floor(Math.random()*MAXSESSIONS);
                                    if (Math.floor(Math.random()*2) == 0) {
                                        store.get("VALID"+k, (function(cb, x) { return function(err, session) {
                                            if (err) {
                                                cb(err);
                                            } else if (!session) {
                                                cb(new Error("No session for key 'VALID"+x+"'"));
                                            } else if (session.sid != "VALID"+x) {
                                                cb(new Error("value mismatch: " + session.sid + " != 'VALID" + x + "'"));
                                            } else {
                                                cb(null);
                                            }
                                        }; })(group(), k));
                                    } else {
                                        store.set("VALID"+k,
                                                  {cookie: {expires: false}, name: "User"+k, sid: "VALID"+k, incr: i},
                                                  (function(cb, x) { return function(err) {
                                            if (err) {
                                                cb(err);
                                            } else {
                                                cb(null);
                                            }
                                        }; })(group(), k));
                                    }
                                }
                            },
                            function(err) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null);
                                }
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    }
                }
            }
        }
    }
});
                
suite["export"](module);
