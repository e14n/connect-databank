// middleware-test.js
//
// Test that stuff actually works as middleware
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
  http = require("http"),
  vows = require("vows"),
  databank = require("databank"),
  Step = require("step"),
  stream = require("stream"),
  util = require("util"),
  Logger = require("bunyan"),
  connect = require("connect"),
  session = require("express-session"),
  Browser = require("zombie"),
  Databank = databank.Databank;

var suite = vows.describe("middleware interface");

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
        return middleware(session);
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
        "and we start an app using the store": {
          topic: function(store) {
            var cb = this.callback,
            app = connect();

            // We use this to leak the session data

            app.callback = null;
            app.setCallback = function(callback) {
              this.callback = callback;
            };

            app.use(session({secret: "test", store: store}));

            app.use(function(req, res) {
              var cb;
              req.session.lastUrl = req.originalUrl;
              if (req.session.hits) {
                req.session.hits++;
              } else {
                req.session.hits = 1;
              }
              res.end("Hello, world!");
              // Leak the session out the side door
              if (app.callback) {
                cb = app.callback;
                process.nextTick(function() {
                  cb(null, req.session);
                });
              }
            });

            server = http.createServer(app);
            server.app = app;

            server.listen(1516, function() {
              cb(null, server);
            });
          },
          "it works": function(err, server) {
            assert.ifError(err);
            assert.ok(server);
          },
          "teardown": function(server) {
            if (server && server.close) {
              server.close(function(err) {});
            }
          },
          "and we create a browser": {
            topic: function(server, store) {
              return new Browser();
            },
            "it works": function(br) {
              assert.isObject(br);
            },
            "and we browse to the server": {
              topic: function(br, server, store) {
                var cb = this.callback,
                sess = null;
                server.app.setCallback(function(err, session) {
                  sess = session;
                });
                br.visit("http://localhost:1516/first", function(err, browser) {
                  cb(err, sess);
                });
              },
              "it works": function(err, session) {
                assert.ifError(err);
                assert.isObject(session);
                assert.equal(session.hits, 1);
                assert.equal(session.lastUrl, "/first");
              },
              "and we browse again": {
                topic: function(old, br, server, store) {
                  var cb = this.callback,
                  sess = null;
                  server.app.setCallback(function(err, session) {
                    sess = session;
                  });
                  br.visit("http://localhost:1516/second", function(err, browser) {
                    cb(err, sess);
                  });
                },
                "it works": function(err, session) {
                  assert.ifError(err);
                  assert.isObject(session);
                  assert.equal(session.hits, 2);
                  assert.equal(session.lastUrl, "/second");
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
