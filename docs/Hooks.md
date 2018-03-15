# Hooks

Hooks allow you to hook into different parts of the request [lifecycle](Lifecycle.md).
They provide similar functionality to Express and Koa middleware.

Hooks can be added with the `app.addHook()` method:

```js
app.addHook(hookName, hookHandler)
```

The possible `hookName` values are:

+ [`'onRequest'`](#onRequest-preHandler-hooks)
+ [`'preHandler'`](#onRequest-preHandler-hooks)
+ [`'onSend'`](#onSend-hook)
+ [`'onFinished'`](#onFinished-hook)

Check out the [lifecycle docs](Lifecycle.md) to see where each hook is executed in the request lifecycle.

Hooks that are `async` (or return a Promise) will have errors automatically caught and forwarded
to the error handler. See the [Using `async-await`](#async-await) section for more information.

Hooks are affected by Medley's encapsulation, and can thus be scoped to selected routes.
See the [Encapsulation](#encapsulation) section for more information.

<a id="onRequest-preHandler-hooks"></a> 
## The `onRequest` and `preHandler` Hooks

```js
app.addHook('onRequest', (request, response, next) => {
  // Handle onRequest
  next()
})

app.addHook('preHandler', (request, response, next) => {
  // Handle preHandler
  next()
})
```

+ `request` - Medley [Request](Request.md) object.
+ `response` - Medley [Response](Response.md) object.
+ `next([error])` - Function to continue to the next hook.

`onRequest` hooks are executed at the very beginning of each request and `preHandler` hooks are
executed before the route handler is invoked (see the [Lifecycle docs](Lifecycle.md) for details).

These hooks are similar to Express middleware.

### `beforeHandler`

Functions passed as the `beforeHandler` option to [`app.route()`](Routes.md#route-method)
have exactly the same signature as `preHandler` hooks and are executed immediately after
any `preHandler` hooks. This is similar to route-level middleware in Express.

```js
app.route({
  method: 'GET',
  path: '/',
  beforeHandler(request, response, next) {
    // Do something, like authorization
    next()
  },
  handler(request, response) {
    response.send({ hello: 'user' })
  }
})
```

### Sending a Response

It is possible to respond to a request within the `onRequest` and `preHandler` hooks. This will skip the rest of the `onRequest` and `preHandler` hooks and the route handler.

```js
app.addHook('preHandler', (request, response, next) => {
  response.send({ early: 'response' })
})
```

If sending a response from inside a hook, **`next()` must not be called**.

### Handling Errors

If an error occurs during the execution of a hook, it should be passed to `next()` to end
the hook execution and trigger an error response.

```js
app.addHook('onRequest', (req, res, next) => {
  next(new Error('some error'))
})
```

The error will be handled by [`Response#error`](Response.md#error).

<a id="onSend-hook"></a> 
## The `onSend` Hook

```js
app.addHook('onSend', (request, response, payload, next) => {
  // Handle onSend
  next()
})
```

+ `request` - Medley [Request](Request.md) object.
+ `response` - Medley [Response](Response.md) object.
+ `payload` - The serialized payload.
+ `next([error, [payload]])` - Function to continue to the next hook and optionally update the payload.

The `onSend` hooks are run right after `response.send()` is called and the payload
has been serialized. They provide a great opportunity to save application state
(e.g. sessions) and set extra headers before the response is sent.

### Modifying the Payload

It is possible to modify the payload before it is sent by passing the modified
payload as the second argument to `next()`. The payload may only be changed
to a `string`, a `Buffer`, a `stream`, or `null`.

```js
app.get('/', (request, response) => {
  response.send({ hello: 'world' })  
})

app.addHook('onSend', (request, response, payload, next) => {{
  console.log(payload) // '{"hello":"world"}'
  const newPayload = Buffer.from(payload)
  next(null, newPayload)
})
```

Changing the payload is mainly intended to be used for encoding the payload
(e.g. compressing it) or clearing the payload by setting it to `null` for a
`304 Not Modified` response.

### `onSend` Hooks and Errors

`onSend` hooks are only run once per request. If an `onSend` hook forwards an error
(with `next(error)` or by throwing in an `async` function), the hooks will not be
executed again when the error response is sent. Because of this, it is best to
handle errors in the hook when possible rather than forwarding the error.

<a id="onFinished-hook"></a> 
## The `onFinished` Hook

```js
app.addHook('onFinished', (request, response) => {
  // Handle onFinished
})
```

+ `request` - Medley [Request](Request.md) object
+ `response` - Medley [Response](Response.md) object

The `onFinished` hook is different from the other hooks. It only receives the
[`request`](Request.md) and [`response`](Response.md) object and is executed synchronously.
Any errors that occur during this hook must be handled manually.

```js
app.addHook('onFinished', async (request, response) => {
  try {
    await asyncFunction()
  } catch (error) {
    // Handle error
  }
})
```

`onFinished` hooks are run once the response has finished sending (or if the underlying
connection was terminated before the response could finish sending).

<a id="async-await"></a> 
## Using `async-await`

Hooks may be an `async` function. For convenience, all hooks (except for the `onFinished` hook)
will automatically catch errors thrown in an `async` function and call `next(error)` for you.

```js
app.addHook('preHandler', async (request, response, next) => {
  const user = await loadUser() // No need to wrap in a try-catch
  request.user = user
  next()
})
```

<a id="encapsulation"></a>
## Encapsulation

Hooks can be encapsulated following Medley's sub-app encapsulation model so
that they only run on routes in the same encapsulation scope.

```js
app.addHook('onRequest', (request, response, next) => {
  request.top = true // Runs for all routes
  next()
})

app.register((subApp1, options, done) => {
  subApp1.addHook('onRequest', (request, response, next) => {
    request.one = 1 // Only runs for routes in `subApp1`
    next()
  })

  subApp1.get('/route-1', (request, response) => {
    console.log(request.top) // true
    console.log(request.one) // 1
    console.log(request.two) // undefined
    response.send()
  })

  done()
})

app.register((subApp2, options, done) => {
  subApp2.addHook('onRequest', (request, response, next) => {
    request.two = 2 // Only runs for routes in `subApp2`
    next()
  })

  subApp2.get('/route-2', (request, response) => {
    console.log(request.top) // true
    console.log(request.one) // undefined
    console.log(request.two) // 2
    response.send()
  })

  done()
})
```
