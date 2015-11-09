// connect-databank.js
//
// Store connect session in a databank
//
// Copyright 2012-2013 E14N Inc. http://e14n.com/
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

require("set-immediate");

var _ = require("underscore"),
    uuid = require("node-uuid"),
    async = require("async");

module.exports = function(connect) {

    var Store = connect.session.Store;

    var DatabankStore = function(bank, parentLog, cleanupInterval) {

        var store = this,
            log,
            isActive = function(session) {

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

        if (parentLog) {
            log = parentLog.child({component: "connect-databank"});
        }

        store.get = function(sid, callback) {

            async.waterfall([
                function(callback) {
                    bank.read("session", sid, function(err, session) {
                        if (err && err.name == "NoSuchThingError") {
                            if (log) log.debug({sid: sid}, "No session in get()");
                            callback(null, null);
                        } else if (err) {
                            callback(err, null);
                        } else {
                            callback(null, session);
                        }
                    });
                },
                function(session, callback) {
                    if (!session) {
                        callback(null, session);
                    } else if (!isActive(session)) {
                        // delete it later
                        // XXX: should we just leave it for cleanup()?
                        setImmediate(function() {
                            bank.del("session", sid, function(err) {
                                if (err) {
                                    if (log) log.error({err: err, sid: sid}, "Error deleting inactive session");
                                } else {
                                    if (log) log.debug({sid: sid}, "Inactive session; deleted.");
                                }
                            });
                        });
                        callback(null, null);
                    } else {
                        callback(null, session);
                    }
                }
            ], function(err, session) {
                if (err) {
                    if (log) log.error(err);
                    callback(err, null);
                } else {
                    if (log) log.debug({sid: sid, session: session}, "Got session.");
                    callback(null, session);
                }
            });
        };

        store.set = function(sid, sess, callback) {

            // connect sets this... usually.

            if (!_.has(sess, "sid")) {
                sess.sid = sid;
            }

            async.waterfall([
                function(callback) {
                    bank.save("session", sid, sess, callback);
                }
            ], function(err, saved) {
                if (err) {
                    if (log) log.error(err);
                    callback(err);
                } else {
                    if (log) log.debug({sid: sid, session: sess}, "Saved session.");
                    callback(null);
                }
            });
        };

        store.destroy = function(sid, callback) {

            async.waterfall([
                function(callback) {
                    bank.del("session", sid, callback);
                }
            ], function(err) {
                if (err && err.name == "NoSuchThingError") {
                    if (log) log.debug({sid: sid}, "Destroy for non-existent session; all good.");
                    callback(null);
                } else if (err) {
                    if (log) log.error(err);
                    callback(err);
                } else {
                    if (log) log.debug({sid: sid}, "Destroy for found session");
                    callback(null);
                }
            });
        };

        store.all = function(callback) {

            async.waterfall([
                function(callback) {
                    var sessions = [],
                        keepActive = function(session) {
                            if (isActive(session)) {
                                sessions.push(session);
                            }
                        };
                    bank.scan("session", keepActive, function(err) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, sessions);
                        }
                    });
                }
            ], function(err, sessions) {
                if (err) {
                    if (log) log.error(err);
                    callback(err, null);
                } else {
                    if (log) log.debug({count: sessions.length}, "Retrieved all sessions");
                    callback(null, sessions);
                }
            });
        };

        store.length = function(callback) {

            async.waterfall([
                function(callback) {
                    var lng = 0,
                        incr = function(session) { lng++; };
                    bank.scan("session", incr, function(err) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, lng);
                        }
                    });
                }
            ], function(err, lng) {
                if (err) {
                    if (log) log.error(err);
                    callback(err, null);
                } else {
                    if (log) log.debug({length: lng}, "Retrieved count of sessions");
                    callback(null, lng);
                }
            });
        };

        store.clear = function(callback) {

            async.waterfall([
                function(callback) {
                    var sids = [];
                    bank.scan("session", function(session) { sids.push(session.sid); }, function(err) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, sids);
                        }
                    });
                },
                function(sids, callback) {
                    var delSid = function(sid, callback) {
                        bank.del("session", sid, callback);
                    };
                    async.eachLimit(sids, 16, delSid, callback);
                }
            ], function(err) {
                if (err) {
                    if (log) log.error(err);
                    callback(err);
                } else {
                    if (log) log.debug("Cleared all sessions.");
                    callback(null);
                }
            });
        };

        // XXX: should this be public?

        store.cleanup = function(callback) {

            var cid = uuid.v4(),
                q,
                cleanupSession = function(sid, callback) {
                    if (log) log.debug({sid: sid, cid: cid}, "Deleting inactive session.");
                    bank.del("session", sid, function(err) {
                        if (err && err.name == "NoSuchThingError") {
                            if (log) log.debug({sid: sid, cid: cid}, "Missing inactive session on delete; ignoring.");
                            callback(null);
                        } else if (err) {
                            if (log) log.error({sid: sid, cid: cid, err: err}, "Error deleting this session.");
                            callback(err);
                        } else {
                            if (log) log.debug({sid: sid, cid: cid}, "Successfully deleted session.");
                            callback(null);
                        }
                    });
                },
                check = function(session) {
                    setImmediate(function() {
                        if (isActive(session)) {
                            if (log) log.debug({sid: session.sid, cid: cid}, "Ignoring active session.");
                        } else {
                            if (log) log.debug({sid: session.sid, cid: cid}, "Queuing inactive session for cleanup.");
                            q.push(session.sid); 
                        }
                    });
                },
                scanDone = false;

            if (log) log.debug({cid: cid}, "Starting cleanup.");

            q = async.queue(cleanupSession, 16);

            q.drain = function() {
                if (log) log.debug({cid: cid}, "Queue is empty.");
                if (scanDone) {
                    if (log) log.debug({cid: cid}, "Finished cleaning up.");
                    callback(null);
                }
            };

            bank.scan("session", check, function(err) {
                if (err) {
                    if (log) log.error({cid: cid, err: err}, "Error scanning sessions.");
                    callback(err);
                } else {
                    if (log) log.debug({cid: cid}, "Finished scanning sessions; waiting for queue to drain.");
                    scanDone = true;
                }
            });
        };

        store.close = function() {
            var self = this;
            clearInterval(self.interval);
            clearTimeout(self.timeout);
        };

        // Set up cleanup to happen every so often.

        if (cleanupInterval) {
            // Since there may be multiple processes trying to clean up,
            // We stagger our cleanup randomly somewhere over the interval period
            store.timeout = setTimeout(function() {
                var doCleanup = function() {
                    store.cleanup(function(err) {
                        if (err) {
                            if (log) log.error(err, "Error cleaning up sessions");
                        } else {
                            if (log) log.debug("Finished cleaning up sessions.");
                        }
                    });
                };
                doCleanup();
                store.interval = setInterval(function() {
                    doCleanup();
                }, cleanupInterval);
            }, Math.floor(Math.random()*cleanupInterval));
        }
    };

    // This is weird

    DatabankStore.prototype.__proto__ = Store.prototype;

    // A schema, for those who want it

    DatabankStore.schema = {
        session: {
            pkey: "sid"
        }
    };

    return DatabankStore;
};
