# App

A new `app` is created by calling the [`medley` factory function](Medley.md).
Sub-apps—created with [`app.createSubApp()`](#createsubapp)—are child apps
that inherit from the `app` that created them. Both an *app* and a *sub-app*
may be referred to as an *app instance*.

```js
const medley = require('@medley/medley');
const app = medley();
```

**Properties:**

+ [`.basePath`](#base-path)
+ [`.handler`](#handler)
+ [`.server`](#server)

**Methods:**

+ [`.addHook(hookName, hookHandler)`](#add-hook)
+ [`.close([callback])`](#close)
+ [`.createSubApp([prefix])`](#createsubapp)
+ [`.decorate(name, value)`](#decorate)
+ [`.decorateRequest(name, value)`](#decorate-request)
+ [`.decorateResponse(name, value)`](#decorate-response)
+ [`.listen(port [, host][, backlog][, callback])`](#listen)
+ [`.load([callback])`](#load)
+ [`.onClose(callback)`](#on-close)
+ [`.onLoad(callback)`](#on-load)
+ [`.register(plugin [, options])`](#register)
+ [`.route(options)`](#route)
+ [`.setNotFoundHandler([options,] handler)`](#set-not-found-handler)
+ [`[@@iterator]()`](#iterator)


## Properties

<a id="base-path"></a>
### `app.basePath`

The path that will be prefixed to routes in a sub-app. Example:

```js
const subApp = app.createSubApp('/v1');
console.log(subApp.basePath); // '/v1'

const subSubApp = subApp.createSubApp('/user');
console.log(subSubApp.basePath); // '/v1/user'
```

<a id="handler"></a>
### `app.handler`

The function passed to `http.createServer()` that handles requests.

This property is `null` until the app has finished [loading](#load).

Helpful when testing with tools like [`supertest`](https://github.com/visionmedia/supertest).

```js
const request = require('supertest');

describe('GET /', function() {
  it('responds successfully', async function() {
    const app = buildAppSomehow();

    await app.load();

    return request(app.handler)
      .get('/')
      .expect('content-type', /html/)
      .expect(200);
  });
});
```

<a id="server"></a>
### `app.server`

The `app`’s [HTTP](https://nodejs.org/api/http.html#http_class_http_server),
[HTTPS](https://nodejs.org/api/https.html#https_class_https_server), or
[HTTP/2](https://nodejs.org/api/http2.html#http2_class_http2secureserver)
server. This will be the custom server set with [Medley’s `server` option](Medley.md#server),
or if option was not used, the server automatically created for the `app`.


## Methods

<a id="add-hook"></a>
### `app.addHook(hookName, hookHandler)`

+ Chainable

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

<a id="createsubapp"></a>
### `app.createSubApp([prefix])`

+ `prefix` *(string)* - A prefix for all routes defined in the sub-app (e.g `'/v1'`).

Returns a new sub-app.

A sub-app is created as as snapshot of its parent and inherits its parent's
[hooks](Hooks.md) and [app decorators](Decorators.md#decorate). New hooks
and app decorators that are added to the sub-app are scoped only to that
sub-app and its own sub-apps.

A `prefix` string can be specified which will be the prefix for all routes
defined on the sub-app. Prefixes are compounded for nested sub-apps. See the
[Route Prefixing](Routes.md#route-prefixing) section for details on how the
`prefix` option affects routes.

```js
const medley = require('@medley/medley');
const app = medley();

{
  const subApp = app.createSubApp();

  subApp.addHook('onRequest', (req, res, next) => {
    // This hook only runs for routes defined on this sub-app
    next();
  });

  subApp.get('/status', (req, res) => res.send('OK'));
}

{
  const apiApp = app.createSubApp('/api');

  apiApp.addHook('onRequest', (req, res, next) => {
    // This hook only runs for routes defined on the apiApp and v1App
    next();
  });

  apiApp.get('/me', (req, res) => { // Route URL is: /api/me
    // Get current user
  });

  const v1App = apiApp.createSubApp('/v1');

  v1App.post('/login', (req, res) => { // Route URL is: /api/v1/login
    // Log user in
  });
}
```

A more common pattern than the example above would be to define routes in a
separate file like a plugin and use [`app.register()`](#register) to register
the routes on the sub-app.

**routes.js**

```js
module.exports = function routes(subApp) {
  subApp.get('/user/:id', (req, res) => {
    // Get a user
  });

  subApp.post('/user', (req, res) => {
    // Create a user
  });
};
```

**app.js**

```js
const medley = require('@medley/medley');
const app = medley();

app.createSubApp('/api').register(require('./routes'));
```

<a id="decorate"></a>
### `app.decorate(name, value)`

+ Chainable

Safely adds a new property to the `app`. See the [Decorators](Decorators.md) documentation.

<a id="decorate-request"></a>
### `app.decorateRequest(name, value)`

+ Chainable

Safely adds a new property to the [`Request`](Request.md) object for the current
`app` instance. See the [Decorators](Decorators.md) documentation.

<a id="decorate-response"></a>
### `app.decorateResponse(name, value)`

+ Chainable

Safely adds a new property to the [`Response`](Response.md) object for the current
`app` instance. See the [Decorators](Decorators.md) documentation.

<a id="listen"></a>
### `app.listen([port[, host[, backlog]]][, callback])`

+ `port` *(number)* - The port to listen on. Default: `0`.
+ `host` *(string)* - The host (or IP address) from which incoming connections will be accepted. Default: `localhost`.
+ `backlog` *(number)* - The maximum length of the queue of pending connections. Default: `511`.
+ `callback` *(function)* - A function that is called once the server has started listening for incoming connections.
+ Returns: *(?Promise)* - A Promise is returned if the `callback` parameter is not used.

Starts the server on the given port after the app has finished [loading](#load).

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
+ Chainable

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
+ Chainable

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

+ Chainable

Registers a plugin with the `app`. See the [Plugins](Plugins.md) documentation.

```js
app.register(require('@medley/cookie'), {
  secret: 'supersecret'
});
```

Also useful for registering groups of routes.

**routes.js**
```js
module.exports = function routes(app) {
  app.get('/user', ...);
  app.post('/user', ...);
  // etc
}
```

**app.js**
```js
const medley = require('@medley/medley');
const app = medley();

app.register(require('./routes'));
```

<a id="route"></a>
### `app.route(options)`

+ Chainable

Registers a new route handler. There are also shorthand methods (like `app.get()`)
that aren't included here. See the [Routes](Routes.md) documentation.

<a id="set-not-found-handler"></a>
### `app.setNotFoundHandler([options,] handler)`

+ `options` *object* - Accepts the `responseSchema`, `preHandler`, and `config` options defined in [Routes#options](Routes.md#options).
+ `handler(req, res)` *(function)* - A request handler function that receives the [`request`](Request.md) and [`response`](Response.md) objects.
+ Chainable

Sets the handler that will be called when no registered route matches the
incoming request. The handler is treated like a regular route handler so
requests will go through the full [request lifecycle](Lifecycle.md).

```js
app.setNotFoundHandler((req, res) => {
  // Send "404 Not Found" response
});
```

Sub-apps that are registered with a [`prefix`](#createsubapp) can have
their own not-found handler.

```js
app.setNotFoundHandler((req, res) => {
  // Default not-found handler
});

const subApp = app.createSubApp('/v1');

subApp.setNotFoundHandler((req, res) => {
  // Handle unmatched requests to URLs that begin with '/v1'
});
```

<a id="iterator"></a>
### `app[@@iterator]()`

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
