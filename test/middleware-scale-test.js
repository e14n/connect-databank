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


var _ = require("underscore"),
  assert = require("assert"),
  vows = require("vows"),
  databank = require("databank"),
  Step = require("step"),
  stream = require("stream"),
  util = require("util"),
  Logger = require("bunyan"),
  connect = require("connect"),
  session = require("express-session"),
  Browser = require("zombie"),
  http = require("http"),
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
                callback(null, store, db);
              } catch (e) {
                callback(e, null, null);
              }
            }
          });
        },
        teardown: function(store, db) {
          if (db && db.disconnect) {
            db.disconnect(function(err) {});
          }
          if (store && store.close) {
            store.close();
          }
        },
        "it works": function(err, store, db) {
          assert.ifError(err);
          assert.isObject(store);
          assert.isObject(db);
        },
        "and we start an app using the store": {
          topic: function(store) {
            var cb = this.callback,
            app = connect();

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

            server.listen(1516, function() {
              cb(null, server);
            });
          },
          teardown: function(server) {
            if (server && server.close) {
              server.close(function(err) {});
            }
          },
          "it works": function(err, server) {
            assert.ifError(err);
            assert.ok(server);
          },
          "and we browse around the app with a few browsers": {

            topic: function(server, store) {

              var callback = this.callback,
              MAXBROWSERS = 100,
              MAXACTIONS = 20,
              MAXPAGE = 10000,
              browsers = [],
              counts = [],
              lasts = [],
              i, j, k,
              sidOf = function(br) {
                var val, sid;
                var objs = br.cookies.select("connect.sid");
                if (!objs || objs.length === 0) {
                  return null;
                } else {
                  val = objs[0].value;
                  decoded = decodeURIComponent(val);
                  match = decoded.match(/^s:(.+)\./);
                  if (match) {
                    sid = match[1];
                    return sid;
                  } else {
                    return null;
                  }
                }
              },
              wanderAround = function(br, id, pagesLeft, callback) {
                var p = Math.floor(Math.random() * MAXPAGE),
                oldSid = sidOf(br);
                br.visit("http://localhost:1516/"+p, function(err) {
                  if (err) {
                    callback(err, null);
                  } else if (pagesLeft == 1) {
                    lasts[id] = p;
                    callback(null, br);
                  } else if (oldSid && sidOf(br) != oldSid) {
                    callback(new Error("SID of browser changed from " + oldSid + " to " + sidOf(br)));
                  } else {
                    wanderAround(br, id, pagesLeft - 1, callback);
                  }
                });
              };

              Step(
                function() {
                  var group = this.group(), i;
                  for (i = 0; i < MAXBROWSERS; i++) {
                    counts[i] = 10 + Math.floor(Math.random()*20);
                    wanderAround(new Browser(), i, counts[i], group());
                  }
                },
                function(err, browsers, ps) {
                  var group = this.group();
                  if (err) throw err;
                  _.each(browsers, function(br, i) {
                    var sid = sidOf(br);
                    var cb = group();
                    if (sid) {
                      store.get(sid, function(err, session) {
                        if (err) {
                          cb(err);
                        } else if (_.isNull(session)) {
                          cb(new Error("No such session for sid " + sid));
                        } else {
                          cb(null, session);
                        }
                      });
                    } else {
                      cb(new Error("No sid for browser " + i));
                    }
                  });
                },
                function(err, sessions) {
                  if (err) {
                    callback(err);
                  } else {
                    callback(err, lasts, counts, sessions);
                  }
                }
              );
            },
            "it works": function(err, lasts, counts, sessions) {
              assert.ifError(err);
            },
            "session data is correct": function(err, lasts, counts, sessions) {
              var i;
              assert.ifError(err);
              for (i = 0; i < sessions.length; i++) {
                assert.isObject(sessions[i], "Session #" + i + " is not an object");
                assert.equal(sessions[i].hits, counts[i], "hits for session #" + i + " is " + sessions[i].hits + ", expected " + counts[i]);
                assert.equal(sessions[i].lastUrl, "/"+lasts[i], "lastUrl for session #" + i + " is " + sessions[i].lastUrl + ", expected /" + lasts[i]);
              }
            }
          }
        }
      }
    }
  }
});

suite["export"](module);
