// cleanup-test.js
//
// Test that inactive sessions are cleaned up
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

var fs = require("fs"),
path = require("path"),
assert = require("assert"),
vows = require("vows"),
databank = require("databank"),
Step = require("step"),
stream = require("stream"),
util = require("util"),
Logger = require("bunyan"),
Databank = databank.Databank;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "config.json")));

var suite = vows.describe("cleanup interface");

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
      "and we instantiate a store with a 5 second cleanup interval": {
        topic: function(DatabankStore) {
          var callback = this.callback,
          db = Databank.get(tc.driver, tc.params);

          db.connect(tc.params, function(err) {
            var store;
            if (err) {
              callback(err, null);
            } else {
              try {
                store = new DatabankStore(db, null, 5000);
                callback(null, store);
              } catch (e) {
                callback(e, null);
              }
            }
          });
        },
        teardown: function(store) {
          if (store && store.bank && store.bank.disconnect) {
            store.bank.disconnect(function(err) {});
          }
          if (store && store.close) {
            store.close();
          }
        },
        "it works": function(err, store) {
          assert.ifError(err);
          assert.isObject(store);
        },
        "and we add a bunch of sessions": {
          topic: function(store) {
            var cb = this.callback;

            Step(
              function() {
                var i, group = this.group(), now = Date.now();
                for (i = 0; i < 5000; i++) {
                  store.set("OLD"+i, {cookie: {expires: now + 10000}, number: i}, group());
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
          "and we wait 9 seconds": {
            topic: function(store) {
              var cb = this.callback;
              setTimeout(function() {
                cb(null);
              }, 9000);
            },
            "it works": function(err) {
              assert.ifError(err);
            },
            "and we add a bunch more sessions": {
              topic: function(store) {
                var cb = this.callback;

                Step(
                  function() {
                    var i, group = this.group(), now = Date.now();
                    for (i = 0; i < 5000; i++) {
                      store.set("NEW"+i, {cookie: {expires: now + 10000}, number: i + 5000, sid: "NEW"+i}, group());
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
              "and we wait 6 more seconds (total 15)": {
                topic: function(store) {
                  var cb = this.callback;
                  setTimeout(function() {
                    cb(null);
                  }, 6000);
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
                  "the new ones are there": function(err, sessions) {
                    var i, sids = {};
                    assert.ifError(err);
                    assert.isArray(sessions);
                    for (i = 0; i < sessions.length; i++) {
                      sids[sessions[i].number] = true;
                    }
                    for (i = 5000; i < 10000; i++) {
                      assert.include(sids, i);
                    }
                  },
                  "the old ones are not there": function(err, sessions) {
                    var i, sids = {};
                    assert.ifError(err);
                    assert.isArray(sessions);
                    for (i = 0; i < sessions.length; i++) {
                      sids[sessions[i].number] = true;
                    }
                    for (i = 0; i < 5000; i++) {
                      assert.isUndefined(sids[i]);
                    }
                  }
                },
                "and we get an old session": {
                  topic: function(store) {
                    store.get("OLD50", this.callback);
                  },
                  "it works": function(err, session) {
                    assert.ifError(err);
                    assert.isNull(session);
                  }
                },
                "and we get a new session": {
                  topic: function(store) {
                    store.get("NEW50", this.callback);
                  },
                  "it works": function(err, session) {
                    assert.ifError(err);
                    assert.isObject(session);
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
