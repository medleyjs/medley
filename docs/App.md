# App

A new `app` is created by calling the [`medley` factory function](Medley.md). Sub-apps—created
with [`app.encapsulate()`](#encapsulate)—are apps that inherit from the `app` that created them. Both an *app*
and a *sub-app* may be referred to as an *app instance*.

```js
const medley = require('@medley/medley');
const app = medley();
```

**Properties:**

+ [`.basePath`](#base-path)
+ [`.server`](#server)

**Methods:**

+ [`.addBodyParser(contentType, parser)`](#add-body-parser)
+ [`.addHook(hookName, hookHandler)`](#add-hook)
+ [`.close([callback])`](#close)
+ [`.decorate(name, value)`](#decorate)
+ [`.decorateRequest(name, value)`](#decorate-request)
+ [`.decorateResponse(name, value)`](#decorate-response)
+ [`.encapsulate([prefix,] subAppFn)`](#encapsulate)
+ [`.inject(options [, callback])`](#inject)
+ [`.listen(port [, host][, backlog][, callback])`](#listen)
+ [`.load([callback])`](#load)
+ [`.onClose(callback)`](#on-close)
+ [`.onLoad(callback)`](#on-load)
+ [`.register(plugin [, options])`](#register)
+ [`.route(options)`](#route)
+ [`.routesToString()`](#routes-to-string)
+ [`.setErrorHandler(handler)`](#set-error-handler)
+ [`.setNotFoundHandler([options,] handler)`](#set-not-found-handler)
+ [`[@@iterator]()`](#iterator)


## Properties

<a id="base-path"></a>
### `app.basePath`

The path that will be prefixed to routes in a sub-app. Example:

```js
app.encapsulate('/v1', (subApp) => {
  console.log(subApp.basePath); // '/v1'

  subApp.encapsulate('/user', (subSubApp) => {
    console.log(subSubApp.basePath); // '/v1/user'
  });
});
```

<a id="server"></a>
### `app.server`

The [HTTP server](https://nodejs.org/api/http.html#http_class_http_server) (or
[HTTP/2 server](https://nodejs.org/api/http2.html#http2_class_http2secureserver))
automatically created for the `app`.


## Methods

<a id="add-body-parser"></a>
### `app.addBodyParser(contentType, parser)`

Adds a new body parser. See the [Body Parser](BodyParser.md) documentation.

<a id="add-hook"></a>
### `app.addHook(hookName, hookHandler)`

Adds a hook that will be run during the request [lifecycle](Lifecycle.md).
See the [Hooks](Hooks.md) documentation.

<a id="close"></a>
### `app.close([callback])`

+ `callback(err)` *(function)* - Called when all [`onClose`](#on-close) handlers have finished.
  + `err` *(null | Error | Error[])*

Shuts down the app by closing the server and running the [`onClose`](#on-close) handlers.
If a `callback` is provided, it will be called once all of the handlers have completed.
The `callback` will receive an error object as the first parameter if one of
the handlers failed, or an array of errors if multiple handlers failed.

```js
app.close((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  process.exit();
});
```

<a id="decorate"></a>
### `app.decorate(name, value)`

Safely adds a new property to the `app`. See the [Decorators](Decorators.md) documentation.

<a id="decorate-request"></a>
### `app.decorateRequest(name, value)`

Safely adds a new property to the [`Request`](Request.md) object for the current
`app` instance. See the [Decorators](Decorators.md) documentation.

<a id="decorate-response"></a>
### `app.decorateResponse(name, value)`

Safely adds a new property to the [`Response`](Response.md) object for the current
`app` instance. See the [Decorators](Decorators.md) documentation.

<a id="encapsulate"></a>
### `app.encapsulate([prefix,] subAppFn)`

+ `prefix` *(string)* - A prefix for all routes defined in the sub-app (e.g `'/v1'`).
+ `subAppFn(subApp)` *(function)* - A function that will be called immediately with the created sub-app.

Creates a new sub-app and passes it to the `subAppFn` function. Optionally,
a `prefix` string can be specified which will be the prefix for all routes
defined on the `subApp`. Prefixes are compounded for nested sub-apps.

```js
const medley = require('@medley/medley');
const app = medley();

app.encapsulate((subApp) => {
  subApp.addHook('onRequest', (req, res, next) => {
    // This hook only runs for routes defined on this sub-app
    next();
  });

  subApp.get('/status', (req, res) => res.send('OK'));
});

app.encapsulate('/api', (apiSubApp) => {
  apiSubApp.addHook('onRequest', (req, res, next) => {
    // This hook only runs for routes defined within the apiSubApp
    next();
  });

  apiSubApp.get('/user', (req, res) => { // Route URL is: /api/user
    // Get user
  });

  apiSubApp.encapsulate('/v1', (v1SubApp) => {
    v1SubApp.post('/user', (req, res) => { // Route URL is: /api/v1/user
      // Create a new user
    });
  });
});
```

See the [Route Prefixing](Routes.md#route-prefixing) section for details on
how the `prefix` option affects routes.

Note that the `subAppFn` is executed immediately:

```js
app.encapsulate((subApp) => {
  // This code runs first
});

// This code runs second
app.decorate('a', {});
```

<a id="inject"></a>
### `app.inject(options [, callback])`

Performs a fake HTTP request on the `app` (for testing purposes). See the [Testing](Testing.md#inject) documentation.

<a id="listen"></a>
### `app.listen(port [, host][, backlog][, callback])`

+ `port` *(number)* - The port to listen on.
+ `host` *(string)* - The host (or IP address) from which incoming connections will be accepted. Default: `localhost`.
+ `backlog` *(number)* - The maximum length of the queue of pending connections. Default: `511`.
+ `callback` *(function)* - A function that is called once the server has started listening for incoming connections.
+ Returns: *(?Promise)* - A Promise is returned if the `callback` parameter is not used.

Starts the server on the given port after all plugins and sub-apps have loaded.

By default, the server will only listen for requests from the `localhost`
address (`127.0.0.1` or `::1` depending on the OS).

If listening for requests from any IP address is desired, then `0.0.0.0` can
be used to listen on all IPv4 addresses and `::` can be used to listen on all
IPv6 addresses (as well as all IPv4 addresses, depending on the OS). Listening
on all addresses would be desirable when using Node inside Docker or on a
remote server that should accept connections from any address.

```js
app.listen(3000, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Server listening on port ' + app.server.address().port);
});
```

If no callback is provided, a Promise is returned:

```js
app.listen(3000, '0.0.0.0')
  .then(() => console.log('Listening'))
  .catch((err) => {
    console.log('Error starting server:', err);
    process.exit(1);
  });
```

<a id="load"></a>
### `app.load([callback])`

+ `callback(err)` *(function)* - Called when all [`onLoad`](#on-load) handlers have finished.
  + `err` *(Error)* - The callback is passed an Error if one occurred during the loading process.

Starts the process of running all [`onLoad`](#on-load) handlers.

```js
app.load((err) => {
  if (err) throw err;
});
```

If the `callback` argument is omitted, a Promise will be returned:

```js
app.load()
  .then(() => {
    console.log('Successfully loaded!');
  }, (err) => {
    console.log(err);
  });
```

<a id="on-close"></a>
### `app.onClose(handler)`

+ `handler([done])` *(function)* - Called when the `app` is shutting down. Receives the following parameter:
  + `done([err])` *(function)* - A function to call when the `handler` is finished. A Promise can be returned instead of calling this function.

Registers a function that will be called when the `app` is shutting down (triggered
by [`app.close()`](#close)). Useful for things like releasing database connections.

```js
app.onClose(function onCloseHandler(done) {
  app.db.end(err => done(err));
});
```

If the `handler` is an `async` function (or returns a promise), the `done`
callback does not need to be used since the handler will be considered
finished when the promise resolves (or rejects).

```js
app.onClose(async function() {
  console.log('closing database connections');
  await app.db.end();
  console.log('database connections closed');
});
```

**Note:** Using both async functions/promises and the `done` callback will cause undefined behavior.

<a id="on-load"></a>
### `app.onLoad(handler)`

+ `handler([done])` *(function)* - Called when the `app` is starting up. Receives the following parameter:
  + `done([err])` *(function)* - A function to call when the `handler` is finished. A Promise can be returned instead of calling this function.

Registers a function that will be called when the `app` is starting up
(triggered by [`app.load()`](#load), [`app.listen()`](#listen), or
[`app.inject()`](#inject)). `onLoad` handlers are run one at a time, with
the next handler only be called once the previous handler completes.

Useful for asynchronous setup operations.

```js
app.onLoad(function onLoadHandler(done) {
  app.db.connect(config, err => done(err));
});
```

If the `handler` is an `async` function (or returns a promise), the `done`
callback does not need to be used since the handler will be considered
finished when the promise resolves (or rejects).

```js
app.onLoad(async function() {
  console.log('setting up database connection');
  await app.db.connect(config);
  console.log('connected to database');
});
```

**Note:** Using both async functions/promises and the `done` callback will cause undefined behavior.

<a id="register"></a>
### `app.register(plugin [, options])`

Registers a plugin with the `app`. See the [Plugins](Plugins.md) documentation.

<a id="route"></a>
### `app.route(options)`

Registers a new route handler. There are also shorthand methods (like `app.get()`)
that aren't included here. See the [Routes](Routes.md) documentation.

<a id="routes-to-string"></a>
### `app.routesToString()`

Returns a string representing the registered routes and their methods.

```js
app.get('/test', () => {});
app.get('/v1/user', () => {});
app.post('/v1/user', () => {});

console.log(app.routesToString());
```

```
/test (GET)
/v1/user (GET,POST)
```

<a id="set-error-handler"></a>
### `app.setErrorHandler(handler)`

+ `handler(err, req, res)` *(function)* - A request handler function that receives the following parameters:
  + `err` - The [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) that occurred during the request.
  + `req` - The Medley [`request`](Request.md) object.
  + `res` - The Medley [`response`](Response.md) object.

Sets a handler that will be called whenever an error occurs. The handler is fully
encapsulated, so different sub-apps can set different error handlers. `async-await`
is supported just like with [regular route handlers](Routes.md#async-await).

```js
app.setErrorHandler((err, req, res) => {
  // Send error response
});
```

Before the error handler is invoked, the response status code associated with the error
is automatically set. See the [`Response#error`](Response.md#error-status-code) docs
for more information on where this status code may come from.

<a id="set-not-found-handler"></a>
### `app.setNotFoundHandler([options,] handler)`

+ `options` *object* - Accepts the `responseSchema`, `preHandler`, and `config` options defined in [Routes#options](Routes.md#options).
+ `handler(req, res)` *(function)* - A request handler function that receives the [`request`](Request.md) and [`response`](Response.md) objects.

Sets the handler that will be called when no registered route matches the
incoming request. The handler is treated like a regular route handler so
requests will go through the full [request lifecycle](Lifecycle.md).

```js
app.setNotFoundHandler((req, res) => {
  // Send "404 Not Found" response
});
```

Sub-apps that are registered with a [`prefix`](SubApps.md#prefix) can have
their own not-found handler.

```js
app.setNotFoundHandler((req, res) => {
  // Default not-found handler
});

app.encapsulate('/v1', (subApp) => {
  subApp.setNotFoundHandler((req, res) => {
    // Handle unmatched requests to URLs that begin with '/v1'
  });
});
```

<a id="iterator"></a>
### `app.[@@iterator]()`

Returns an iterator that can be used to iterate over the registered routes.

```js
app.get('/test', () => {});
app.get('/v1/user', () => {});
app.post('/v1/user', () => {});

const iterator = app[Symbol.iterator]();
const route1 = iterator.next().value;
const route2 = iterator.next().value;
// etc.
console.log(route1); // ['/test', { GET: {...} }]
```

Instead of calling the method, the `app` would normally be iterated over using `for...of`.

```js
for (const [routePath, methods] of app) {
  console.log(routePath, '-', methods);
}
```

```
/test - { GET: {...} }
/v1/user - { GET: {...}, POST: {...} }
```

The route `methods` value is an object that maps method names to the route context
(the same value that will be available as [`res.route`](Response.md#resroute)).

Note that some values in the route context are not set until the `app` has
finished [loading](#load).
