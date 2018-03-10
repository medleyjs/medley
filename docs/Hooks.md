# Hooks

Hooks are registered with the `app.addHook()` method and allow you to hook into different parts of the application or request lifecycle.

## Request Lifecycle Hooks

Hooks can be added with the `app.addHook()` method:

```js
app.addHook(hookName, hookHandler)
```

The possible `hookName` values are:

+ [`'onRequest'`](#onRequest-preHandler-hooks)
+ [`'preHandler'`](#onRequest-preHandler-hooks)
+ [`'onSend'`](#onSend-hook)
+ [`'onResponse'`](#onResponse-hook)

Check out the [lifecycle docs](Lifecycle.md) to see where each hook is executed in the request lifecycle.

Hooks are affected by Medley's encapsulation, and can thus be scoped to selected routes.
See the [Scopes](#scope) section for more information.

<a id="onRequest-preHandler-hooks"></a> 
### The `onRequest` and `preHandler` Hooks

```js
app.addHook('onRequest', (request, reply, next) => {
  // Handle onRequest
  next()
})

app.addHook('preHandler', (request, reply, next) => {
  // Handle preHandler
  next()
})
```

+ `request` - Medley [Request](Request.md) object
+ `reply` - Medley [Reply](Reply.md) object
+ `next([error])` - Function to continue with the request

`onRequest` hooks are executed at the very beginning of each request and `preHandler` hooks are
executed before the route handler is invoked (see the [Lifecycle docs](Lifecycle.md) for details).

These hooks are similar to Express middleware.

#### `beforeHandler`

Functions passed as the `beforeHandler` option to [`app.route()`](Routes.md#route-method)
have exactly the same signature as `preHandler` hooks and are executed immediately after
any `preHandler` hooks. This is similar to route-level middleware in Express.

#### Sending a Response

It is possible to respond to a request within the `onRequest` and `preHandler` hooks. This will skip the rest of the `onRequest` and `preHandler` hooks and the route handler.

```js
app.addHook('preHandler', (request, reply, next) => {
  reply.send({ early: 'response' })
})
```

If sending a response from inside a hook, **`next()` must not be called**.

#### Handling Errors

If an error occurs during the execution of a hook, it should be passed to `next()` to end
the hook execution and trigger an error response.

```js
app.addHook('onRequest', (req, res, next) => {
  next(new Error('some error'))
})
```

The error will be handled by [`Reply#error`](Reply.md#error).

<a id="onSend-hook"></a> 
### The `onSend` Hook

```js
app.addHook('onSend', (request, reply, payload, next) => {
  // Handle onSend
  next()
})
```

+ `request` - Medley [Request](Request.md) object
+ `reply` - Medley [Reply](Reply.md) object
+ `payload` - The serialized payload
+ `next([error, [payload]])` - Function to continue with the request

The `onSend` hooks provide a great opportunity to save application state
(e.g. sessions) and set extra headers before the response is sent.

#### Modifying the Payload

It is possible to modify the payload before it is sent by passing the modified
payload as the second argument to `next()`. The payload may only be changed
to a `string`, a `Buffer`, a `stream`, or `null`.

```js
app.get('/', (request, reply) => {
  reply.send({ hello: 'world' })  
})

app.addHook('onSend', (request, reply, payload, next) => {{
  console.log(payload) // '{"hello":"world"}'
  const newPayload = Buffer.from(payload)
  next(null, newPayload)
})
```

Changing the payload is mainly intended to be used for encoding the payload
(e.g. compressing it) or clearing the payload by setting it to `null` for a
`304 Not Modified` response.

#### `onSend` Hooks and Errors

`onSend` hooks are only run once per request. If an `onSend` hook forwards an error
(with `next(error)` or by throwing in an `async` function), the hooks will not be
executed again when the error response is sent. Because of this, it is best to
handle errors in the hook when possible rather than forwarding the error.

<a id="onResponse-hook"></a> 
### The `onResponse` Hook

```js
app.addHook('onResponse', (res) => {
  // Handle onResponse
})
```

+ `res` - Node.js [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) object

The `onResponse` hook is different from the other hooks. It only receives the
[`res`](https://nodejs.org/api/http.html#http_class_http_serverresponse) object
and is executed synchronously. Any errors that occur during this hook must be
handled manually.

```js
app.addHook('onResponse', async (res) => {
  try {
    await asyncFunction()
  } catch (error) {
    // Handle error
  }
})
```

### Using async-await

Hooks may be an `async` function. For convenience, all hooks (except for the `onResponse` hook) will automatically catch errors thrown in an `async` function and call `next(error)` for you.

```js
app.addHook('preHandler', async (request, reply, next) => {
  const user = await loadUser() // No need to wrap in a try-catch
  request.user = user
  next()
})
```

## Application Hooks

You are able to hook into the application-lifecycle as well. It's important to note that these hooks aren't fully encapsulated. The `this` inside the hooks are encapsulated but the handlers can respond to an event outside the encapsulation boundaries.

- `'onClose'`
- `'onRoute'`

<a name="on-close"></a>
**'onClose'**<br>
Triggered when `app.close()` is invoked to stop the server. It is useful when [plugins](Plugins.md) need a "shutdown" event, such as a connection to a database.<br>
The first argument is the app instance, the second one the `done` callback.
```js
app.addHook('onClose', (app, done) => {
  // some code
  done()
})
```
<a name="on-route"></a>
**'onRoute'**<br>
Triggered when a new route is registered. Listeners are passed a `routeOptions` object as the sole parameter. The interface is synchronous, and, as such, the listeners do not get passed a callback.
```js
app.addHook('onRoute', (routeOptions) => {
  routeOptions.url
  routeOptions.beforeHandler
  routeOptions.customValuePassedToRoute // For example
})
```
<a name="scope"></a>
### Scope
Except for [Application Hooks](#application-hooks), all hooks are encapsulated. This means that you can decide where your hooks should run by using `register` as explained in the [plugins guide](Plugins-Guide.md). If you pass a function, that function is bound to the right Medley context and from there you have full access to the Medley API.

```js
app.addHook('onRequest', function (req, res, next) {
  const self = this // Medley context
  next()
})
```

<a name="before-handler"></a>
### beforeHandler
Despite the name, `beforeHandler` is not a standard hook like `preHandler`, but is a function that your register right in the route option that will be executed only in the specified route. Can be useful if you need to handle the authentication at route level instead of at hook level (`preHandler` for example.), it could also be an array of functions.<br>
**`beforeHandler` is executed always after the `preHandler` hook.**

```js
app.addHook('preHandler', (request, reply, done) => {
  // your code
  done()
})

app.route({
  method: 'GET',
  url: '/',
  beforeHandler: function (request, reply, done) {
    // your code
    done()
  },
  handler: function (request, reply) {
    reply.send({ hello: 'world' })
  }
})

app.route({
  method: 'GET',
  url: '/',
  beforeHandler: [
    function first (request, reply, done) {
      // your code
      done()
    },
    function second (request, reply, done) {
      // your code
      done()
    }
  ],
  handler: function (request, reply) {
    reply.send({ hello: 'world' })
  }
})
```
