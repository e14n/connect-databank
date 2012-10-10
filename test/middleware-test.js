// middleware-test.js
//
// Test the middleware interface
//
// Copyright 2012, E14N Inc.
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
    Databank = databank.Databank;

var methodContext = function(name) {
    return function(err, store) {
        assert.ifError(err);
        assert.isObject(store);
        assert.isFunction(store[name]);
    };
};

var suite = vows.describe("store module interface");

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
            "and we instantiate a store": {
                topic: function(DatabankStore) {
                    var callback = this.callback,
                        db = Databank.get("memory", {});

                    db.connect({}, function(err) {
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
                },
                "it works": function(err, store, DatabankStore) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
                "it has the right type": function(err, store, DatabankStore) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
                "it has a get() method": methodContext("get"),
                "it has a set() method": methodContext("set"),
                "it has a destroy() method": methodContext("destroy"),
                "it has an all() method": methodContext("all"),
                "it has a length() method": methodContext("length"),
                "it has a clear() method": methodContext("clear"),
                "and we check the object type": {
                    topic: function(store, DatabankStore) {
                        var cb = this.callback;
                        cb(null, store, DatabankStore);
                    },
                    "it has the right type": function(err, store, DatabankStore) {
                        assert.ifError(err);
                        assert.isObject(store);
                        assert.instanceOf(store, DatabankStore);
                    }
                },
                "and we get() a session in an empty store": {
                    topic: function(store) {
                        var callback = this.callback;
                        store.get("NONEXISTENT1", callback);
                    },
                    "it works": function(err, session) {
                        assert.ifError(err);
                    },
                    "it returns null": function(err, session) {
                        assert.ifError(err);
                        assert.isNull(session);
                    }
                },
                "and we destroy() a session in an empty store": {
                    topic: function(store) {
                        var callback = this.callback;
                        store.destroy("NONEXISTENT2", callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    }
                },
                "and we get all() in an empty store": {
                    topic: function(store) {
                        var callback = this.callback;
                        store.all(callback);
                    },
                    "it works": function(err, sessions) {
                        assert.ifError(err);
                    },
                    "it returns an array": function(err, sessions) {
                        assert.ifError(err);
                        assert.isArray(sessions);
                    },
                    "it returns an empty array": function(err, sessions) {
                        assert.ifError(err);
                        assert.isArray(sessions);
                        assert.isEmpty(sessions);
                    }
                },
                "and we get length() in an empty store": {
                    topic: function(store) {
                        var callback = this.callback;
                        store.length(callback);
                    },
                    "it works": function(err, count) {
                        assert.ifError(err);
                    },
                    "it returns a number": function(err, count) {
                        assert.ifError(err);
                        assert.isNumber(count);
                    },
                    "it returns zero": function(err, count) {
                        assert.ifError(err);
                        assert.isNumber(count);
                        assert.equal(count, 0);
                    }
                }
            }
        }
    }
});

suite["export"](module);


