# Defining Routes

To define routes, Medley supports both a *Hapi*-like [`.route()` method](#route-method) and
also *Express/Restify*-like [shorthand methods](#shorthand-methods) such as `.get()`.

## Route Method

```js
app.route(options)
```

### Options

+ `method`: The name of an HTTP method or an array of methods. The supported methods are:
  + `'GET'`
  + `'HEAD'`
  + `'POST'`
  + `'PUT'`
  + `'PATCH'`
  + `'DELETE'`
  + `'OPTIONS'`
+ `path`: The path to match the URL of the request.
+ `url`: Alias for `path`.
+ `responseSchema`: The schema for a JSON response. See the [`Serialization` documentation](Serialization.md).
+ `beforeHandler(request, reply, next)`: A [function](Hooks.md#before-handler) or an array of functions called just before the request handler. `beforeHandler` functions are treated just like `preHandler` hooks.
+ `handler(request, reply)`: The main function that will handle the request.
+ `bodyLimit`: Limits request bodies to this number of bytes. Must be an integer. Used to override the `bodyLimit` option passed to the [`Medley factory function`](Factory.md#bodylimit).
+ `config`: Object used to store custom configuration.

`request` is defined in [Request](Request.md).

`reply` is defined in [Reply](Reply.md).


Example:

```js
app.route({
  method: 'GET',
  path: '/',
  responseSchema: {
    200: {
      hello: { type: 'string' }
    }
  },
  handler(request, reply) {
    reply.send({ hello: 'world' })
  }
})

app.route({
  method: ['POST', 'PUT'],
  path: '/comment',
  beforeHandler(request, reply, next) {
    // Validate the request
    next()  
  },
  handler(request, reply) {
    // Create a user comment
  }  
})
```

## Shorthand Methods

```js
app.get(path, [options], handler)
app.head(path, [options], handler)
app.post(path, [options], handler)
app.put(path, [options], handler)
app.patch(path, [options], handler)
app.delete(path, [options], handler)
app.options(path, [options], handler)
```

Example:

```js
const beforeHandler = [
  function authenticate(request, reply, next) { ... },
  function validate(request, reply, next) { ... },
]
app.get('/', { beforeHandler }, (request, reply) => {
  reply.send({ hello: 'world' })
})
```

Additionally, there is an `app.all()` shorthand method that will register a handler for all of the supported methods.

```js
app.all(path, [options], handler)
```

## URL-building
Medley supports both static and dynamic urls.<br>
To register a **parametric** path, use the *colon* before the parameter name. For **wildcard** use the *star*.
*Remember that static routes are always checked before parametric and wildcard.*

```js
// parametric
app.get('/example/:userId', (request, reply) => {}))
app.get('/example/:userId/:secretToken', (request, reply) => {}))

// wildcard
app.get('/example/*', (request, reply) => {}))
```

Regular expression routes are supported as well, but pay attention, RegExp are very expensive in term of performance!
```js
// parametric with regexp
app.get('/example/:file(^\\d+).png', (request, reply) => {}))
```

It's possible to define more than one parameter within the same couple of slash ("/"). Such as:
```js
app.get('/example/near/:lat-:lng/radius/:r', (request, reply) => {}))
```
*Remember in this case to use the dash ("-") as parameters separator.*

Finally it's possible to have multiple parameters with RegExp.
```js
app.get('/example/at/:hour(^\\d{2})h:minute(^\\d{2})m', (request, reply) => {}))
```
In this case as parameter separator it's possible to use whatever character is not matched by the regular expression.

Having a route with multiple parameters may affect negatively the performance, so prefer single parameter approach whenever possible, especially on routes which are on the hot path of your application.
If you are interested in how we handle the routing, checkout [find-my-way](https://github.com/delvedor/find-my-way).

## Async-Await
Are you an `async/await` user? We have you covered!
```js
app.get('/', options, async function (request, reply) {
  var data = await getData()
  var processed = await processData(data)
  return processed
})
```
As you can see we are not calling `reply.send` to send back the data to the user. You just need to return the body (given that body is not `undefined`) and you are done!
If you need it you can also send back the data to the user with `reply.send`.
```js
app.get('/', options, async function (request, reply) {
  var data = await getData()
  var processed = await processData(data)
  reply.send(processed)
})
```

**Warning:** If `return someValue` and `reply.send()` are used at the same time, the first one that happens takes precedence; the second value will be ignored.

## Route Prefixing
Sometimes you need to maintain two or more different versions of the same api, a classic approach is to prefix all the routes with the api version number, `/v1/user` for example.
Medley offers you a fast and smart way to create different version of the same api without changing all the route names by hand, *route prefixing*. Let's see how it works:

```js
// server.js
const app = require('@medley/medley')()

app.register(require('./routes/v1/users'), { prefix: '/v1' })
app.register(require('./routes/v2/users'), { prefix: '/v2' })

app.listen(3000)
```
```js
// routes/v1/users.js
module.exports = function(app, opts, next) {
  app.get('/user', handler_v1)
  next()
}
```
```js
// routes/v2/users.js
module.exports = function(app, opts, next) {
  app.get('/user', handler_v2)
  next()
}
```
Medley will not complain because you are using the same name for two different routes, because at compilation time it will handle the prefix automatically *(this also means that the performance will not be affected at all!)*.

Now your clients will have access to the following routes:
- `/v1/user`
- `/v2/user`

You can do this as many times as you want, it works also for nested `register` and routes parameter are supported as well.
Be aware that if you use [`fastify-plugin`](https://github.com/fastify/fastify-plugin) this option won't work.
