# Defining Routes

To define routes, Medley supports both a *Hapi*-like [`.route()` method](#route-method) and
also *Express/Restify*-like [shorthand methods](#shorthand-methods) such as `.get()`.

## Route Method

```js
app.route(options)
```

### Options

+ `method`: The name of an HTTP method or an array of methods. The supported methods are:
  + `'GET'`, `'HEAD'`, `'POST'`, `'PUT'`, `'PATCH'`, `'DELETE'`, `'OPTIONS'`
+ `path`: The path to match the URL of the request.
+ `url`: Alias for `path`.
+ `responseSchema`: The schema for a JSON response. See the [`Serialization` documentation](Serialization.md).
+ `beforeHandler(req, res, next)`: A function or an array of functions called just before the request handler. They are treated just like `preHandler` hooks (see [Hooks#beforehandler](Hooks.md#beforehandler)).
+ `handler(req, res)`: The main function that will handle the request.
+ `bodyLimit`: Limits request bodies to this number of bytes. Must be an integer. Used to override the `bodyLimit` option passed to the [`Medley factory function`](Factory.md#bodylimit).
+ `config`: Object used to store custom configuration. Defaults to an empty object (`{}`).

`req` is defined in [Request](Request.md).<br>
`res` is defined in [Response](Response.md).

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
  handler(req, res) {
    res.send({ hello: 'world' })
  }
})

app.route({
  method: ['POST', 'PUT'],
  path: '/comment',
  beforeHandler: function(req, res, next) {
    // Validate the request
    next()  
  },
  handler: function(req, res) {
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

// Registers a route that handles all supported methods
app.all(path, [options], handler)
```

Example:

```js
const beforeHandler = [
  function authenticate(req, res, next) { ... },
  function validate(req, res, next) { ... },
]
app.get('/', { beforeHandler }, (req, res) => {
  res.send({ hello: 'world' })
})
```

The `handler` may be specified in the `options` object if the third parameter is omitted:

```js
app.get('/path', {
  beforeHandler: [ ... ],
  responseSchema: { ... },
  handler: function(req, res) {
    res.send()
  }
})
```

*If the `handler` is specified in both the `options` object and as the
third parameter, the third parameter will take precedence.*

## URL-building
Medley supports both static and dynamic urls.<br>
To register a **parametric** path, use the *colon* before the parameter name. For **wildcard** use the *star*.
*Remember that static routes are always checked before parametric and wildcard.*

```js
// parametric
app.get('/example/:userId', (req, res) => {}))
app.get('/example/:userId/:secretToken', (req, res) => {}))

// wildcard
app.get('/example/*', (req, res) => {}))
```

Regular expression routes are supported as well, but pay attention, RegExp are very expensive in term of performance!
```js
// parametric with regexp
app.get('/example/:file(^\\d+).png', (req, res) => {}))
```

It's possible to define more than one parameter within the same couple of slash ("/"). Such as:
```js
app.get('/example/near/:lat-:lng/radius/:r', (req, res) => {}))
```
*Remember in this case to use the dash ("-") as parameters separator.*

Finally it's possible to have multiple parameters with RegExp.
```js
app.get('/example/at/:hour(^\\d{2})h:minute(^\\d{2})m', (req, res) => {}))
```
In this case as parameter separator it's possible to use whatever character is not matched by the regular expression.

Having a route with multiple parameters may affect negatively the performance, so prefer single parameter approach whenever possible, especially on routes which are on the hot path of your application.
If you are interested in how we handle the routing, checkout [find-my-way](https://github.com/delvedor/find-my-way).

<a id="async-await"></a>
## Async-Await / Promises

Medley has a convenient feature for `async` functions. If an `async` function returns a value,
it will be sent automatically.

```js
// Using res.send()
app.get('/', async (req, res) => {
  const data = await getDataAsync()
  res.send(data)
})

// Using return
app.get('/', async (req, res) => {
  const data = await getDataAsync()
  return data
})
```

This means that using `async-await` might not be needed at all since awaitable
functions return a promise, which can be returned from a normal function:

```js
app.get('/', (req, res) => {
  return getDataAsync()
})
```

The default status code for responses is `200`. If needed, use `res.status()`
or `res.statusCode` to set the status code before returning:

```js
app.post('/user', (req, res) => {
  res.statusCode = 201 // "201 Created"
  return createUserAsync()
})
```

Note that `res.send()` will not be called automatically if the value returned from an `async` function is `undefined`. This is because returning `undefined` is the same as not returning anything all (see the [MDN `return` documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return#wikiArticle)).

**Warning:** An error will be thrown if `return someValue` and `res.send()` are used at the same time because a response cannot be sent twice.

## Route Prefixing

Sometimes you need to maintain two or more different versions of the same API.
A classic approach is to prefix all the routes with the API version number,
`/v1` for example. To do this, defining every route like this would work:

```js
app.get('/v1/user', (req, res) => { ... })
```

But an alternative is to use [`app.use()`](App.md#use) to create separate
sub-apps with a different prefix for each group of routes:

**app.js**
```js
const medley = require('@medley/medley')
const app = medley()

app.use('/v1', require('./routes/v1/user'))
app.use('/v2', require('./routes/v2/user'))

app.listen(3000)
```

**./routes/v1/user.js**
```js
module.exports = function v1Routes(subApp) {
  subApp.get('/user', (req, res) => {
    // v1 implementation  
  })
}
```

**./routes/v2/user.js**
```js
module.exports = function v2Routes(subApp) {
  subApp.get('/user', (req, res) => {
    // v2 implementation  
  })
}
```

Now the following routes will be defined, each with a different implementation:

+ `/v1/user`
+ `/v2/user`
