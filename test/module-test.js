// module-test.js
//
// Test the module interface
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
  Step = require("step"),
  Databank = databank.Databank;

var methodContext = function(name) {
  return function(err, store) {
    assert.ifError(err);
    assert.isObject(store);
    assert.isFunction(store[name]);
  };
};

var lengthContext = function(cnt) {
  return {
    topic: function(store) {
      store.length(this.callback);
    },
    "it works": function(err, n) {
      assert.ifError(err);
    },
    "it returns a number": function(err, n) {
      assert.ifError(err);
      assert.isNumber(n);
    },
    "it returns the right number": function(err, n) {
      assert.ifError(err);
      assert.isNumber(n);
      assert.equal(n, cnt);
    }
  };
};

var makeStore = function(DatabankStore) {
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
};

var breakStore = function(store) {
  if (store && store.bank && store.bank.disconnect) {
    store.bank.disconnect(function(err) {});
  }
  if (store && store.close) {
    store.close();
  }
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
    "and we apply it to the session module": {
      topic: function(middleware) {
        var session = require("express-session");
        return middleware(session);
      },
      "it works": function(DatabankStore) {
        assert.isFunction(DatabankStore);
      },
      "it has a schema attribute": function(DatabankStore) {
        assert.isFunction(DatabankStore);
        assert.isObject(DatabankStore.schema);
        assert.includes(DatabankStore.schema, "session");
      },
      "and we instantiate a store": {
        topic: makeStore,
        teardown: breakStore,
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
        "it has a cleanup() method": methodContext("cleanup"),
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
        "and we get length() in an empty store": lengthContext(0)
      }
    }
  }
});

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
      "and we instantiate another store": {
        topic: makeStore,
        teardown: breakStore,
        "it works": function(err, store) {
          assert.ifError(err);
          assert.isObject(store);
        },
        "and we clear the empty store": {
          topic: function(store) {
            var callback = this.callback;
            store.clear(callback);
          },
          "it works": function(err) {
            assert.ifError(err);
          }
        }
      }
    }
  }
});

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
      "and we instantiate yet another store": {
        topic: makeStore,
        teardown: breakStore,
        "it works": function(err, store) {
          assert.ifError(err);
          assert.isObject(store);
        },
        "and we set() a new session": {
          topic: function(store) {
            var callback = this.callback,
            session = {
              cookie: {
                expires: false
              },
              name: "Curly",
              sid: "VALID1"
            };

            store.set("VALID1", session, callback);
          },
          "it works": function(err) {
            assert.ifError(err);
          },
          "and we get the same session": {
            topic: function(store) {
              store.get("VALID1", this.callback);
            },
            "it works": function(err, session) {
              assert.ifError(err);
            },
            "it returns an object": function(err, session) {
              assert.ifError(err);
              assert.isObject(session);
            },
            "it returns the right data": function(err, session) {
              assert.ifError(err);
              assert.isObject(session);
              assert.include(session, "name");
              assert.equal(session.name, "Curly");
              assert.include(session, "cookie");
              assert.isObject(session.cookie);
              assert.include(session.cookie, "expires");
              assert.isFalse(session.cookie.expires);
            }
          },
          "and we get all sessions": {
            topic: function(store) {
              store.all(this.callback);
            },
            "it works": function(err, sessions) {
              assert.ifError(err);
            },
            "it returns an array": function(err, sessions) {
              assert.ifError(err);
              assert.isArray(sessions);
            },
            "it returns the right data": function(err, sessions) {
              var session;
              assert.ifError(err);
              assert.isArray(sessions);
              assert.lengthOf(sessions, 1);
              session = sessions[0];
              assert.isObject(session);
              assert.include(session, "name");
              assert.equal(session.name, "Curly");
              assert.include(session, "cookie");
              assert.isObject(session.cookie);
              assert.include(session.cookie, "expires");
              assert.isFalse(session.cookie.expires);
            }
          },
          "and we get the length()": lengthContext(1)
        }
      }
    }
  }
});

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
      "and we instantiate yet another store": {
        topic: makeStore,
        teardown: breakStore,
        "it works": function(err, store) {
          assert.ifError(err);
          assert.isObject(store);
        },
        "and we set() a whole bunch of sessions": {
          topic: function(store) {
            var callback = this.callback;

            Step(
              function() {
                var i, group = this.group();

                for (i = 0; i < 1000; i++) {
                  store.set("LOTS"+i, {cookie: {expires: false}, number: i, sid: "LOTS"+i}, group());
                }
              },
              function(err) {
                callback(err);
              }
            );
          },
          "it works": function(err) {
            assert.ifError(err);
          },
          "and we get the same sessions": {
            topic: function(store) {
              var callback = this.callback;

              Step(
                function() {
                  var i, group = this.group();

                  for (i = 0; i < 1000; i++) {
                    store.get("LOTS"+i, group());
                  }
                },
                function(err, sessions) {
                  callback(err, sessions);
                }
              );
            },
            "it works": function(err, sessions) {
              assert.ifError(err);
            },
            "it returns an array of objects": function(err, sessions) {
              var i;
              assert.ifError(err);
              assert.isArray(sessions);
              assert.lengthOf(sessions, 1000);
              for (i = 0; i < 1000; i++) {
                assert.isObject(sessions[i]);
              }
            },
            "it returns the right data": function(err, sessions) {
              var i, session;
              assert.ifError(err);
              for (i = 0; i < 1000; i++) {
                session = sessions[i];
                assert.isObject(session);
                assert.include(session, "number");
                assert.equal(session.number, i);
                assert.include(session, "cookie");
                assert.isObject(session.cookie);
                assert.include(session.cookie, "expires");
                assert.isFalse(session.cookie.expires);
              }
            }
          },
          "and we get all sessions": {
            topic: function(store) {
              store.all(this.callback);
            },
            "it works": function(err, sessions) {
              assert.ifError(err);
            },
            "it returns an array of objects": function(err, sessions) {
              var i;
              assert.ifError(err);
              assert.isArray(sessions);
              assert.lengthOf(sessions, 1000);
              for (i = 0; i < 1000; i++) {
                assert.isObject(sessions[i]);
              }
            },
            "it returns the right data": function(err, sessions) {
              var i, session;
              assert.ifError(err);
              for (i = 0; i < 1000; i++) {
                session = sessions[i];
                assert.isObject(session);
                assert.include(session, "number");
                assert.equal(session.number, i);
                assert.include(session, "cookie");
                assert.isObject(session.cookie);
                assert.include(session.cookie, "expires");
                assert.isFalse(session.cookie.expires);
              }
            }
          },
          "and we get the length()": lengthContext(1000)
        }
      }
    }
  }
});

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
      "and we instantiate yet another store": {
        topic: makeStore,
        teardown: breakStore,
        "it works": function(err, store) {
          assert.ifError(err);
          assert.isObject(store);
        },
        "and we set() a whole bunch of sessions": {
          topic: function(store) {
            var callback = this.callback;

            Step(
              function() {
                var i, group = this.group();

                for (i = 0; i < 1000; i++) {
                  store.set("MORE"+i, {cookie: {expires: false}, number: i, sid: "MORE"+i}, group());
                }
              },
              function(err) {
                callback(err);
              }
            );
          },
          "it works": function(err) {
            assert.ifError(err);
          },
          "and we destroy() the same sessions": {
            topic: function(store) {
              var callback = this.callback;

              Step(
                function() {
                  var i, group = this.group();

                  for (i = 0; i < 1000; i++) {
                    store.destroy("MORE"+i, group());
                  }
                },
                function(err) {
                  callback(err);
                }
              );
            },
            "it works": function(err) {
              assert.ifError(err);
            },
            "and we get all sessions": {
              topic: function(store) {
                store.all(this.callback);
              },
              "it works": function(err, sessions) {
                assert.ifError(err);
              },
              "it returns an array of objects": function(err, sessions) {
                var i;
                assert.ifError(err);
                assert.isArray(sessions);
                assert.lengthOf(sessions, 0);
              }
            },
            "and we get the length()": lengthContext(0)
          }
        }
      }
    }
  }
});

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
      "and we instantiate yet another store": {
        topic: makeStore,
        teardown: breakStore,
        "it works": function(err, store) {
          assert.ifError(err);
          assert.isObject(store);
        },
        "and we set() a whole bunch of sessions": {
          topic: function(store) {
            var callback = this.callback;

            Step(
              function() {
                var i, group = this.group();

                for (i = 0; i < 1000; i++) {
                  store.set("EVENMORE"+i, {cookie: {expires: false}, number: i, sid: "EVENMORE"+i}, group());
                }
              },
              function(err) {
                callback(err);
              }
            );
          },
          "it works": function(err) {
            assert.ifError(err);
          },
          "and we clear() the store": {
            topic: function(store) {
              store.clear(this.callback);
            },
            "it works": function(err) {
              assert.ifError(err);
            },
            "and we get all sessions": {
              topic: function(store) {
                store.all(this.callback);
              },
              "it works": function(err, sessions) {
                assert.ifError(err);
              },
              "it returns an array of objects": function(err, sessions) {
                var i;
                assert.ifError(err);
                assert.isArray(sessions);
                assert.lengthOf(sessions, 0);
              }
            },
            "and we get the length()": lengthContext(0)
          }
        }
      }
    }
  }
});

suite["export"](module);
