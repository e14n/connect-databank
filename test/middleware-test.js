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
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    stream = require("stream"),
    util = require("util"),
    Logger = require("bunyan"),
    connect = require("connect"),
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
        "and we apply it to the connect module": {
            topic: function(middleware) {
                return middleware(connect);
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

		    db.connect({}, function(err) {
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
		    if (store && store.bank && store.bank.disconnect) {
			store.bank.disconnect(function(err) {});
		    }
		},
                "it works": function(err, store, str) {
                    assert.ifError(err);
                    assert.isObject(store);
                },
		"and we start an app using the store": {
		    topic: function(store, str) {
			var cb = this.callback,
			    app = connect();
			
			app.use(connect.session({secret: "test", store: store}));

			app.use(function(req, res) {
			    res.end("Hello, world!");
			});

			app.listen(1516, function() {
			    cb(null);
			});
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
