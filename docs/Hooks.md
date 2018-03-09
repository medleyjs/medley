# Hooks

Hooks are registered with the `app.addHook()` method and allow you to hook into different parts of the application or request lifecycle.

## Request Lifecycle Hooks

Hooks can be added with the `app.addHook()` method:

```js
app.addHook(hookName, hookHandler)
```

The possible `hookName` values are:

+ `'onRequest'`
+ `'preHandler'`
+ `'onSend'`
+ `'onResponse'`

Check out the [lifecycle docs](Lifecycle.md) to see where each hook is executed in the request lifecycle.

Example:

```js
app.addHook('onRequest', (req, res, next) => {
  // Handle onRequest
  next()
})

app.addHook('preHandler', (request, reply, next) => {
  // Handle preHandler
  next()
})

app.addHook('onSend', (request, reply, next) => {
  // Handle onSend
  next()
})

app.addHook('onResponse', (res) => {
  // Handle onResponse
})
```

| Parameter | Description |
|-----------|-------------|
| `req` | Node.js [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) |
| `res` | Node.js [ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) |
| `request` | Medley [Request](Request.md) object |
| `reply` | Medley [Reply](Reply.md) object |
| `next([error])` | Function to continue with the request |

Note that in the `'preHandler'` and `'onSend'` hook, the `request` and `reply` objects are different from `'onRequest'` because the two arguments are [`request`](Request.md) and [`reply`](Reply.md) core Medley objects.

If an error occurs during the execution of a hook, it should be passed to `next()` to end the hook execution and trigger an error response.

```js
app.addHook('onRequest', (req, res, next) => {
  next(new Error('some error'))
})
```

*The error will be handled by [`Reply`](Reply.md#errorerr).*

Hooks are affected by Medley's encapsulation, and can thus be scoped to selected routes. See the [Scopes](#scope) section for more information.

#### The `onSend` Hook

Inside the `onSend` hook, the serialized payload will be available as the `payload` property on the `reply` object.

```js
app.get('/', (request, reply) => {
  reply.send({ hello: 'world' })  
})
app.addHook('onSend', (request, reply, next) => {
  console.log(reply.payload) // '{"hello":"world"}'
  next()
})
```

It is possible to modify the payload before it is sent by changing the `reply.payload` property.

```js
app.addHook('onSend', (request, reply, next) => {
  reply.payload = reply.payload.replace('world', 'everyone!')
  next()
})
```

Note: The payload may only be changed to a `string`, a `Buffer`, a `stream`, `null`, or `undefined`.

#### The `onResponse` Hook

The `onResponse` is different from the other hooks. It only receives the `res` object and is executed synchronously. Any errors that occur during this hook must be handled manually.

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

### Sending a response from a hook

It is possible to respond to a request within `onRequest` and `preHandler` hooks. This will skip the rest of the `onRequest` and `preHandler` hooks and the route handler.

```js
app.addHook('onRequest', (req, res, next) => {
  res.end('early response')
})

app.addHook('preHandler', (request, reply, next) => {
  reply.send({ early: 'response' })
})
```

If sending a response from inside a hook, **`next()` must not be called** (otherwise the rest of the hooks and then the route handler will be run).

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
