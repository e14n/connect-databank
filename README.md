connect-databank
================

Use any database that databank supports as a connect session store

License
-------

Copyright 2012, E14N Inc.

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
[connect](https://npmjs.org/package/connect) session backend.

I think it's particularly useful if you're distributing software and
you don't want to make your users depend on some particular connect
session backend.

How to use it
-------------

Try something like this.

    var connect = require("connect"),
        Logger = require("bunyan"),
        Databank = require("databank").Databank,
        DatabankStore = require("connect-databank")(connect),
	driver,
	params,
        db;

    // Example params. See databank for details.

    driver = "disk";
    params = {dir: "/var/lib/databank/session"};

    // Get a bank and connect...

    db = Databank.get(driver, params);

    db.connect({}, function(err) {

        var store, app, log;

	// Use bunyan for logging
        
	log = new Logger({name: "myapp"});

        store = new DatabankStore(db, log);

	app = connect();
	app.use(connect.cookieParser());
	app.use(connect.session({secret: "my dog has fleas", store: store}));

	app.listen(3000);
    });

The DatabankStore will store stuff into the `session` type ("table")
in your databank, keyed by session ID.

It will log out to the logger; you can omit that parameter if you
don't want session logs.
