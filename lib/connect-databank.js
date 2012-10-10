// connect-databank.js
//
// Store connect session in a databank
//
// Copyright 2012 StatusNet Inc.
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

var Step = require("step");

module.exports = function(connect) {

    var Store = connect.session.Store;

    var DatabankStore = function(bank) {
        this.bank = bank;
    };

    // This is weird

    DatabankStore.prototype.__proto__ = Store.prototype;

    DatabankStore.prototype.isActive = function(session) {

        var expires;

        if ('string' == typeof session.cookie.expires) {
            expires = new Date(session.cookie.expires);
        } else {
            expires = session.cookie.expires;
        }
        
        if (!expires || Date.now() < expires) {
            return true;
        } else {
            return false;
        }
    };

    DatabankStore.prototype.get = function(sid, callback) {

        var store = this,
            bank = this.bank;

        Step(
            function() {
                bank.read("session", sid, this);
            },
            function(err, session) {
                if (err && err.name == "NoSuchThingError") {
                    callback(null, null);
                } else if (err) {
                    throw err;
                } else if (store.isActive(session)) {
                    callback(null, session);
                } else {
                    store.destroy(sid, this);
                }
            },
            callback
        );
    };

    DatabankStore.prototype.set = function(sid, sess, callback) {
        var bank = this.bank;

        Step(
            function() {
                bank.save("session", sid, sess, this);
            },
            function(err, session) {
                if (err) throw err;
                bank.append("sessionlist", "active", sid, this);
            },
            function(err, all) {
                callback(err);
            }
        );
    };

    DatabankStore.prototype.destroy = function(sid, callback) {
        var bank = this.bank;

        Step(
            function() {
                bank.del("session", sid, this);
            },
            function(err) {
                if (err && err.name == "NoSuchThingError") {
                    callback(null);
                } else if (err) {
                    throw err;
                } else {
                    bank.remove("sessionlist", "active", sid, this);
                }
            },
            function(err) {
                if (err && err.name == "NoSuchItemError") {
                    callback(null);
                } else if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            }
        );
    };

    DatabankStore.prototype.all = function(callback) {

        var store = this,
            bank = this.bank;

        Step(
            function() {
                bank.get("sessionlist", "active", this);
            },
            function(err, sids) {
                if (err && err.name == "NoSuchItemError") {
                    callback(null, []);
                } else if (err) {
                    throw err;
                } else {
                    bank.readAll("session", sids, this);
                }
            },
            function(err, sessions) {
                if (err) {
                    callback(err, null);
                } else {
                }
            }
        );
    };

    DatabankStore.prototype.length = function(callback) {
    };

    DatabankStore.prototype.clear = function(callback) {
    };

    return DatabankStore;
};
