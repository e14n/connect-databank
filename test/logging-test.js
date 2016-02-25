// logging-test.js
//
// Test the logging 
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
    stream = require("stream"),
    util = require("util"),
    Logger = require("bunyan"),
    Databank = databank.Databank;

var suite = vows.describe("store module interface");

var StreamMock = function() {
    this.writable = true;
    this.callback = null;
    this.output = null;
};

util.inherits(StreamMock, stream.Stream);

StreamMock.prototype.write = function(data) {
    var cb;
    this.output = data;
    if (this.callback) {
	cb = this.callback;
	process.nextTick(function() {
	    cb(null, data);
	});
	this.callback = null;
    }
    return true;
};

StreamMock.prototype.end = function(data) {
    var cb;
    this.output = data;
    if (this.callback) {
	cb = this.callback;
	process.nextTick(function() {
	    cb(null, data);
	});
	this.callback = null;
    }
};

StreamMock.prototype.setCallback = function(callback) {
    var mock = this;
    mock.callback = callback;
};

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
                topic: function(DatabankStore) {
		    var callback = this.callback,
		        db = Databank.get("memory", {}),
		        str = new StreamMock(),
		        log = new Logger({name: "connect-databank-test",
					  stream: str});
		        

		    db.session({}, function(err) {
			var store;
			if (err) {
			    callback(err, null);
			} else {
			    try {
				store = new DatabankStore(db, log);
				callback(null, store, str);
			    } catch (e) {
				callback(e, null);
			    }
			}
		    });
		},
                teardown: function(store, str) {
		    if (store && store.bank && store.bank.dissession) {
			store.bank.dissession(function(err) {});
		    }
		},
                "it works": function(err, store, str) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
		"and we set() a session": {
		    topic: function(store, str) {
			str.setCallback(this.callback);
			store.set("ID1", {cookie: {expires: 0}, example: "foo", sid: "ID1"}, function(err) {});
		    },
		    "it writes to the log": function(err, written) {
			assert.ifError(err);
			assert.ok(written);
		    },
		    "log data looks correct": function(err, written) {
			var obj;
			assert.ifError(err);
			assert.ok(written);
			try {
			    obj = JSON.parse(written);
			    assert.isObject(obj);
			    assert.equal(obj.name, "connect-databank-test");
			    assert.equal(obj.component, "connect-databank");
			    assert.equal(obj.sid, "ID1");
			    assert.isObject(obj.session);
			    assert.isObject(obj.session.cookie);
			    assert.equal(obj.session.cookie.expires, 0);
			    assert.equal(obj.session.example, "foo");
			} catch (e) {
			    assert.ifError(e);
			}
		    },
		    "and we get() a session": {
			topic: function(setlog, store, str) {
			    str.setCallback(this.callback);
			    store.get("ID1", function(err) {});
			},
			"it writes to the log": function(err, written) {
			    assert.ifError(err);
			    assert.ok(written);
			},
			"log data looks correct": function(err, written) {
			    var obj;
			    assert.ifError(err);
			    assert.ok(written);
			    try {
				obj = JSON.parse(written);
				assert.isObject(obj);
				assert.equal(obj.name, "connect-databank-test");
				assert.equal(obj.component, "connect-databank");
				assert.equal(obj.sid, "ID1");
				assert.isObject(obj.session);
				assert.isObject(obj.session.cookie);
				assert.equal(obj.session.cookie.expires, 0);
				assert.equal(obj.session.example, "foo");
			    } catch (e) {
				assert.ifError(e);
			    }
			},
			"and we destroy() a session": {
			    topic: function(getlog, setlog, store, str) {
				str.setCallback(this.callback);
				store.destroy("ID1", function(err) {});
			    },
			    "it writes to the log": function(err, written) {
				assert.ifError(err);
				assert.ok(written);
			    },
			    "log data looks correct": function(err, written) {
				var obj;
				assert.ifError(err);
				assert.ok(written);
				try {
				    obj = JSON.parse(written);
				    assert.isObject(obj);
				    assert.equal(obj.name, "connect-databank-test");
				    assert.equal(obj.component, "connect-databank");
				    assert.equal(obj.sid, "ID1");
				} catch (e) {
				    assert.ifError(e);
				}
			    }
			}
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
            "and we instantiate a store with no logger": {
                topic: function(DatabankStore) {
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
		},
                teardown: function(store) {
		    if (store && store.bank && store.bank.dissession) {
			store.bank.dissession(function(err) {});
		    }
		},
                "it works": function(err, store) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
		"and we set() a session": {
		    topic: function(store) {
			store.set("ID1", {cookie: {expires: 0}, example: "foo", sid: "ID1"}, this.callback);
		    },
		    "it works": function(err) {
			assert.ifError(err);
		    },
		    "and we get() a session": {
			topic: function(store) {
			    store.get("ID1", this.callback);
			},
			"it works": function(err, data) {
			    assert.ifError(err);
			},
			"and we destroy() a session": {
			    topic: function(data, store) {
				store.destroy("ID1", this.callback);
			    },
			    "it works": function(err) {
				assert.ifError(err);
			    },
			}
		    }
		}
	    }
	}
    }
});

suite["export"](module);
