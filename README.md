connect-databank
================

Use any database that databank supports as a session session store

License
-------

Copyright 2012, 2015, E14N Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

What's it do?
-------------

The [databank](https://npmjs.org/package/databank) package lets you
use several different kinds of databases - Mongo, Redis, CouchBase,
memory, disk - with a uniform API -- basically CRUD + search.

This module will let you use any of those databases as a
[session](https://npmjs.org/package/session) session backend.

I think it's particularly useful if you're distributing software and
you don't want to make your users depend on some particular session
session backend.

How to use it
-------------

Try something like this.

    var express = require("express"),
        cookieParser = require("cookie-parser"),
        session = require("express-session"),
        Logger = require("bunyan"),
        Databank = require("databank").Databank,
        DatabankStore = require("connect-databank")(session),
	      driver,
	      params,
        db;

    // Example params. See databank for details.

    driver = "disk";
    params = {dir: "/var/lib/databank/session"};

    // Get a bank and session...

    db = Databank.get(driver, params);

    db.session({}, function(err) {

        var store, app, log;

	// Use bunyan for logging

	log = new Logger({name: "myapp"});

        // cleanup session store every 5 minutes

        store = new DatabankStore(db, log, 600000);

	app = expess();
	app.use(session.cookieParser());
	app.use(session.session({secret: "my dog has fleas", store: store, cookie: {maxAge: 180000}}));

	app.listen(3000);
    });

The DatabankStore will store stuff into the `session` type ("table")
in your databank, keyed by session ID.

It will log out to the logger; you can omit that parameter if you
don't want session logs.

External API
------------

* `new DatabankStore(bank, log, cleanup)`

  Create a new databank store. `bank` is a `Databank` object. `log` is
  a [bunyan](https://github.com/trentm/node-bunyan) Logger object; if
  it's passed the store will log session info to that log. `cleanup`
  is a session GC interval in milliseconds; if it's not falsy the
  store will garbage-collect old unused sessions this often.

  You pass the DatabankStore to `session.session()` as the `store`
  parameter. See the [session session
  middleware](http://www.senchalabs.org/session/middleware-session.html)
  documentation for more details.

Store interface
---------------

This is the interface that session requires of us. You can fiddle with
it if you want, but watch your fingers. The store will be available as
`req.sessionStore` in your routes.

* `get(sid, callback)`

  Get an existing session with id `sid`; return it to the
  callback. callback gets two parameters: `err` and `session`.

  Note that in the case that a session is not available, the `err`
  value is `null` and `session` is also `null`.

* `set(sid, session, callback)`

  Save session `session` with id `sid`; the `callback` takes a single
  parameter, `err`.

  This should work whether or not the session id is new.

* `destroy(sid, callback)`

  Delete the session with id `sid`; the `callback` takes a single
  parameter, `err`.

  This should work whether or not the session exists.

* `all(callback)`

  Get all sessions that have not expired. `callback` takes two
  parameters: an `err` and an array of sessions.

* `length(callback)`

  Get the count of sessions have not expired. `callback` takes two
  parameters: an `err` and an integer count.

* `clear(callback)`

  Delete all sessions. `callback` takes one parameter: an `err` value.

Bonus features
--------------

* `cleanup(callback)`

  Delete all sessions that have expired. This is the method that's
  called to garbage-collect sessions. `callback` takes one parameter:
  an `err`.

  NOTE that you have to have a `maxAge` on your `cookie` parameter for
  `session.session()` for this to work. It won't clean up sessions
  that never expire -- browser sessions -- even if they're very, very
  old.
