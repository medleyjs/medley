# Server Methods

<a name="server"></a>
#### server
`app.server`: The Node core [server](https://nodejs.org/api/http.html#http_class_http_server) object as returned by the [**`Medley factory function`**](Factory.md).

<a name="ready"></a>
#### ready
Function called when all the plugins has been loaded.
It takes an error parameter if something went wrong.
```js
app.ready(err => {
  if (err) throw err
})
```
If it is called without any arguments, it will return a `Promise`:

```js
app.ready().then(() => {
  console.log('successfully booted!')
}, (err) => {
  console.log('an error happened', err)
})
```

<a name="listen"></a>
#### listen
Starts the server on the given port after all the plugins are loaded, internally waits for the `.ready()` event. The callback is the same as the Node core. By default, the server will listen on address `127.0.0.1` when no specific address is provided. If listening on any available interface is desired, then specifying `0.0.0.0` for the address will listen on all IPv4 address. Using `::` for the address will listen on all IPv6 addresses, and, depending on OS, may also listen on all IPv4 addresses. Be careful when deciding to listen on all interfaces; it comes with inherent [security risks](https://web.archive.org/web/20170831174611/https://snyk.io/blog/mongodb-hack-and-secure-defaults/).

```js
app.listen(3000, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

Specifying an address is also supported:

```js
app.listen(3000, '127.0.0.1', err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

Specifying a backlog queue size is also supported:

```js
app.listen(3000, '127.0.0.1', 511, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

If no callback is provided a Promise is returned:

```js
app.listen(3000)
  .then(() => console.log('Listening'))
  .catch(err => {
    console.log('Error starting server:', err)
    process.exit(1)
  })
```

Specifying an address without a callback is also supported:

```js
app.listen(3000, '127.0.0.1')
  .then(() => console.log('Listening'))
  .catch(err => {
    console.log('Error starting server:', err)
    process.exit(1)
  })
```

When deploying to a Docker, and potentially other, containers, it is advisable to listen on `0.0.0.0` because they do not default to exposing mapped ports to `127.0.0.1`:

```js
app.listen(3000, '0.0.0.0', (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

<a name="route"></a>
#### route
Method to add routes to the server, it also have shorthands functions, check [here](Routes.md).

<a name="close"></a>
#### close
`app.close(callback)`: This function shuts down the app by closing the server and running the [`'onClose'`](Hooks.md#on-close) hooks.

<a name="decorate"></a>
#### decorate*
Function useful if you need to decorate the app, Reply or Request, check [here](Decorators.md).

<a name="register"></a>
#### register
Medley allows the user to extend its functionalities with plugins.
A plugin can be a set of routes, a server decorator or whatever, check [here](Plugins.md).

<a name="addHook"></a>
#### addHook
Function to add a specific hook in the lifecycle of Medley, check [here](Hooks.md).

<a name="base-path"></a>
#### basePath
The path that will be prefixed to a route.

Example:

```js
app.register((subApp, opts, next) => {
  console.log(subApp.basePath) // '/v1'

  subApp.register((subSubApp, opts, next) => {
    console.log(subSubApp.basePath) // '/v1/v2'

    next()
  }, { prefix: '/v2' })

  next()
}, { prefix: '/v1' })
```

<a name="inject"></a>
#### inject
Fake http injection (for testing purposes) [here](Testing.md#inject).

<a name="set-not-found-handler"></a>
#### setNotFoundHandler

`app.setNotFoundHandler(handler(request, reply))`: set the 404 handler. This call is encapsulated by prefix, so different plugins can set different not found handlers if a different [`prefix` option](Plugins.md#route-prefixing-option) is passed to `app.register()`. The handler is treated like a regular route handler so requests will go through the full [Medley lifecycle](Lifecycle.md#lifecycle).

```js
app.setNotFoundHandler((request, reply) => {
  // Default not found handler
})

app.register((subApp, options, next) => {
  subApp.setNotFoundHandler(function (request, reply) {
    // Handle not found request to URLs that begin with '/v1'
  })
  next()
}, { prefix: '/v1' })
```

<a name="set-error-handler"></a>
#### setErrorHandler

`app.setErrorHandler(handler(error, request, reply))`: Set a function that will be called whenever an error happens. The handler is fully encapsulated, so different plugins can set different error handlers. *async-await* is supported as well.

```js
app.setErrorHandler(function (error, request, reply) {
  // Send error response
})
```

<a name="print-routes"></a>
#### printRoutes

`app.printRoutes()`: Prints the representation of the internal radix tree used by the router, useful for debugging.<br/>
*Remember to call it inside or after a `ready` call.*

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
