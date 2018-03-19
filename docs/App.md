# App

A new `app` is created by calling the [`medley` factory function](Factory.md).

```js
const medley = require('@medley/medley')
const app = medley()
```

**Properties:**

+ [`.basePath`](#base-path)
+ [`.server`](#server)

**Methods:**

+ [`.addBodyParser(hookName, hookHandler)`](#add-body-parser)
+ [`.addHook(hookName, hookHandler)`](#add-hook)
+ [`.close([callback])`](#close)
+ [`.decorate(name, value)`](#decorate)
+ [`.decorateRequest(name, value)`](#decorate-request)
+ [`.decorateResponse(name, value)`](#decorate-response)
+ [`.inject(options [, callback])`](#inject)
+ [`.listen(port [, host][, backlog][, callback])`](#listen)
+ [`.onClose(callback)`](#on-close)
+ [`.printRoutes()`](#print-routes)
+ [`.ready([callback])`](#ready)
+ [`.registerPlugin(plugin [, options])`](#register-plugin)
+ [`.route(options)`](#route)
+ [`.setErrorHandler(handler)`](#set-error-handler)
+ [`.setNotFoundHandler(handler)`](#set-not-found-handler)
+ [`.use([prefix,] subAppFn)`](#use)


## Properties

<a id="base-path"></a>
### `app.basePath`

The path that will be prefixed to routes in a sub-app. Example:

```js
app.use('/v1', (subApp) => {
  console.log(subApp.basePath) // '/v1'

  subApp.use('/user', (subSubApp) => {
    console.log(subSubApp.basePath) // '/v1/user'
  })
})
```

<a id="server"></a>
### `app.server`

The [HTTP server](https://nodejs.org/api/http.html#http_class_http_server) (or
[HTTP 2 server](https://nodejs.org/api/http2.html#http2_class_http2secureserver))
automatically created for the `app`.


## Methods

<a id="add-body-parser"></a>
### `app.addBodyParser()`

Adds a new body parser. See the [Body Parser](BodyParser.md) documentation.

<a id="add-hook"></a>
### `app.addHook(hookName, hookHandler)`

Adds a hook that will be run during the request [lifecycle](Lifecycle.md).
See the [Hooks](Hooks.md) documentation.

<a id="close"></a>
### `app.close([callback])`

Shuts down the app by closing the server and running the [`'onClose'`](Hooks.md#on-close) hooks.
If a `callback` is provided, it will be called once all of the `onClose` hooks have completed.

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

<a id="inject"></a>
### `app.inject(options [, callback])`

Performs a fake HTTP request on the `app` (for testing purposes). See the [Testing](Testing.md#inject) documentation.

<a id="listen"></a>
### `app.listen(port [, host][, backlog][, callback])`

+ `port` *(number)* - The port to listen on.
+ `host` *(string)* - The host (or IP address) from which incoming connections will be accepted. Default: `127.0.0.1`.
+ `backlog` *(number)* - The maximum length of the queue of pending connections. Default: `511`.
+ `callback` *(function)* - A function that is called once the server has started listening for incoming connections.
+ Returns: *(?Promise)* - A Promise is returned if the `callback` parameter is not used.

Starts the server on the given port after all plugins and sub-apps have loaded.

By default, the server will only listen for requests from the local IP address
(`127.0.0.1`). If listening for requests from any IP address is desired, then
`0.0.0.0` can be used to listen on all IPv4 addresses and `::` can be used to
listen on all IPv6 addresses, and on most OSs, may also listen on all IPv4
addresses (this would be desirable when using Node inside Docker or on a
remote server that should accept connections from any address).

```js
app.listen(3000, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log('Server listening on port ' + app.server.address().port)
})
```

If no callback is provided, a Promise is returned:

```js
app.listen(3000, '0.0.0.0')
  .then(() => console.log('Listening'))
  .catch((err) => {
    console.log('Error starting server:', err)
    process.exit(1)
  })
```

<a id="on-close"></a>
### `app.onClose(handler)`

+ `handler(app, done)` *(function)* - Called when the `app` is shutting down. Receives the following parameters:
  + `app` - The `app` instance that `.onClose()` was called on.
  + `done([err])` *(function)* - A function that must be called when the `handler` is finished.

Registers a function that will be called when the `app` is shutting down (triggered
by [`app.close()`](#close)). Useful for things like releasing database connections.

```js
app.onClose(function(app, done) {
  app.db.end(err => done(err))
})
```

<a id="print-routes"></a>
### `app.printRoutes()`

Prints the representation of the internal radix tree used by the router. Useful for debugging.

*Should be called inside or after a `ready()` call to ensure that all routes will be available.*

```js
app.get('/test', () => {})
app.get('/test/hello', () => {})
app.get('/hello/world', () => {})

app.ready(() => {
  console.log(app.printRoutes())
  // └── /
  //   ├── test (GET)
  //   │   └── /hello (GET)
  //   └── hello/world (GET)
})
```

<a id="ready"></a>
### `app.ready([callback])`

+ `callback(err)` *(function)* - Called when all plugins and sub-apps have finished loading.
  + `err` *(Error)* - The callback is passed an Error if one occurred during the loading process.

Starts the process of loading registered plugins and sub-apps.

```js
app.ready((err) => {
  if (err) throw err
})
```

If the `callback` argument is omitted, a Promise will be returned:

```js
app.ready().then(() => {
  console.log('successfully booted!')
}, (err) => {
  console.log(err)
})
```

<a id="register-plugin"></a>
### `app.registerPlugin(plugin [, options])`

Registers a plugin with the `app`. See the [Plugins](Plugins.md) documentation.

<a id="route"></a>
### `app.route(options)`

Registers a new route handler. There are also shorthand methods (like `app.post()`)
that aren't included here. See the [Routes](Routes.md) documentation.

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
})
```

Before the error handler is invoked, the response status code associated with the error
is automatically set. See the [`Response#error`](Response.md#error-status-code) docs
for more information on where this status code may come from.

<a id="set-not-found-handler"></a>
### `app.setNotFoundHandler(handler)`

+ `handler(req, res)` *(function)* - A request handler function that receives the [`request`](Request.md) and [`response`](Response.md) objects.

Sets the handler that will be called when no registered routes match the
incoming request. The handler is treated like a regular route handler so
requests will go through the full [request lifecycle](Lifecycle.md).

```js
app.setNotFoundHandler((req, res) => {
  // Send 404 Not Found response
})
```

Additional not-found handlers can be set for sub-apps that are registered with
a [`prefix`](SubApps.md#prefix). 

```js
app.setNotFoundHandler((req, res) => {
  // Default not-found handler
})

app.register((subApp, options, next) => {
  subApp.setNotFoundHandler((req, res) => {
    // Handle unmatched request to URLs that begin with '/v1'
  })
  next()
}, { prefix: '/v1' })
```

<a id="use"></a>
### `app.use([prefix,] subAppFn)`

+ `prefix` *(string)* - A prefix for all routes defined in the sub-app (e.g `'/v1'`).
+ `subAppFn(subApp)` *(function)* - A function that will be called immediately with the created sub-app.

Creates a new sub-app and passes it to the `subAppFn` function. Optionally,
a `prefix` string can be specified which will be the prefix for all routes
defined on the `subApp`. Prefixes are compounded for nested sub-apps.

```js
const medley = require('@medley/medley')
const app = medley()

app.use((subApp) => {
  subApp.addHook('onRequest', (req, res, next) => {
    // This hook only runs for routes defined on this sub-app
    next()  
  })
  
  subApp.get('/status', (req, res) => res.send('OK'))
})

app.use('/api', (apiSubApp) => {
  apiSubApp.addHook('onRequest', (req, res, next) => {
    // This hook only runs for routes defined on this "api" sub-app
    next()  
  })
  
  apiSubApp.get('/user', (req, res) => { // Route URL is: /api/user
    // Get user  
  })
  
  apiSubApp.use('/v1', (v1SubApp) => {
    v1SubApp.post('/user', (req, res) => { // Route URL is: /api/v1/user
      // Create a new user  
    })
  })
})
```
