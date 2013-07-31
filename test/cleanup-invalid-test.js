// cleanup-invalid-test.js
//
// Test that inactive sessions are cleaned up
//
// Copyright 2013, E14N Inc.
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
    stream = require("stream"),
    util = require("util"),
    Logger = require("bunyan"),
    Databank = databank.Databank;

var suite = vows.describe("cleanup works for deleted sessions");

suite.addBatch({
    "when we require the connect-databank module": {
        topic: function() {
            return require("../lib/connect-databank");
        },
        "it works": function(middleware) {
            assert.isFunction(middleware);
        },
        "and we apply it to the connect module": {
            topic: function(middleware) {
                var connect = require("connect");
                return middleware(connect);
            },
            "it works": function(DatabankStore) {
                assert.isFunction(DatabankStore);
            },
            "and we instantiate a store with a 5 second cleanup interval": {
                topic: function(DatabankStore) {
		    var callback = this.callback, db = Databank.get("memory", {});

		    db.connect({}, function(err) {
			var store;
			if (err) {
			    callback(err, null);
			} else {
			    try {
				store = new DatabankStore(db, null, 1000);
				callback(null, store, db);
			    } catch (e) {
				callback(e, null, null);
			    }
			}
		    });
		},
                teardown: function(store, db) {
		    if (db) {
			db.disconnect(function(err) {});
		    }
		},
                "it works": function(err, store, db) {
                    assert.ifError(err);
                    assert.isObject(store);
                    assert.isObject(db);
                },
                "and we add a bunch of sessions": {
                    topic: function(store, db) {
                        var cb = this.callback;
                        
                        Step(
                            function() {
                                var i, group = this.group(), now = Date.now();
                                for (i = 0; i < 100; i++) {
                                    store.set("TODEL"+i, {cookie: {expires: now + 180000}, number: i, sid: "TODEL"+i}, group());
                                }
                            },
                            function(err, sessions) {
                                cb(err);
                            }
                        );
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    },
                    "and we delete every other session": {
                        topic: function(store, db) {
                            var cb = this.callback;
                            
                            Step(
                                function() {
                                    var i, group = this.group();
                                    for (i = 0; i < 100; i += 2) {
                                        db.del("session", "TODEL"+i, group());
                                    }
                                },
                                function(err) {
                                    cb(err);
                                }
                            );
                        },
                        "it works": function(err) {
                            assert.ifError(err);
                        },
                        "and we wait 5 seconds": {
                            topic: function(store) {
                                var cb = this.callback;
                                setTimeout(function() {
                                    cb(null);
                                }, 5000);
                            },
                            "it works": function(err) {
                                assert.ifError(err);
                            },
                            "and we get all the available sessions": {
                                topic: function(store) {
                                    store.all(this.callback);
                                },
                                "it works": function(err, sessions) {
                                    assert.ifError(err);
                                    assert.isArray(sessions);
                                },
                                "the undeleted ones are there": function(err, sessions) {
                                    var i, sids = {};
                                    assert.ifError(err);
                                    assert.isArray(sessions);
                                    for (i = 0; i < sessions.length; i++) {
                                        sids[sessions[i].number] = true;
                                    }
                                    for (i = 1; i < 100; i += 2) {
                                        assert.include(sids, i);
                                    }
                                },
                                "the deleted ones are not there": function(err, sessions) {
                                    var i, sids = {};
                                    assert.ifError(err);
                                    assert.isArray(sessions);
                                    for (i = 0; i < sessions.length; i++) {
                                        sids[sessions[i].number] = true;
                                    }
                                    for (i = 0; i < 100; i += 2) {
                                        assert.isUndefined(sids[i]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

suite["export"](module);
