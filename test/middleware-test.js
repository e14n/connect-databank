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
                "it works": function(err, store) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
                "it has a get() method": methodContext("get"),
                "it has a set() method": methodContext("set"),
                "it has a destroy() method": methodContext("destroy"),
                "it has an all() method": methodContext("all"),
                "it has a length() method": methodContext("length"),
                "it has a clear() method": methodContext("clear")
            }
        }
    }
});

suite["export"](module);


