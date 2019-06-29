# Defining Routes

To define routes, Medley supports both a *Hapi*-like [`.route()` method](#route-method) and
also *Express*-like [shorthand methods](#shorthand-methods) (such as `app.get()`).

## Route Method

```js
app.route(options)
```

### Options

+ [`method`](#method-required)
+ [`path`](#path-required)
+ [`handler`](#handler-required)
+ [`preHandler`](#prehandler)
+ [`responseSchema`](#responseschema)
+ [`config`](#config)

#### `method` (required)

Type: `string` | `Array<string>`

The HTTP method(s) the route will run for. Can be any method found in the
[`http.METHODS`](https://nodejs.org/api/http.html#http_http_methods) array
(except for `CONNECT`).

```js
app.route({
  method: 'GET',
  path: '/',
  handler: function(req, res) {
    res.send('hello world');
  }
});

app.route({
  method: ['POST', 'PUT'],
  path: '/user',
  handler: function(req, res) {
    // ...
  }
});
```

#### `path` (required)

Type: `string`

The path to match the URL of the request.

```js
app.route({
  method: 'GET',
  path: '/user/:id',
  handler: function(req, res) {
    console.log(req.params.id); // '1003' (for example)
  }
});
````

See the [URL-Building](#url-building) section for details on the formats
the `path` option can take.

#### `handler` (required)

Type: `function(req, res)`
+ `req` - [Request](Request.md)
+ `res` - [Response](Response.md)

The main function that will handle the request.

```js
app.route({
  method: 'GET',
  path: '/',
  handler: function(req, res) {
    res.send('hello world');
  }
});
```

The `handler` can be an `async` function that returns a value to be sent.

```js
app.route({
  method: 'GET',
  path: '/user/:id',
  handler: async function(req, res) {
    const data = await getUserData(req.params.id);
    return data;
  }
});
```

For more details on `async` handlers, see the [Async-Await](#async-await) section.

#### `preHandler`

Type: `function(req, res, next)` | `Array<function>`

Route-level hooks with the same signature as [`onRequest` hooks](Hooks.md#onRequest-hook).
Similar to route-level middleware in Express.

```js
app.route({
  method: 'POST',
  path: '/comment',
  preHandler: function(req, res, next) {
    // Authorize the user
    next();
  },
  handler: function(req, res) { /*...*/ }
});
```

#### `responseSchema`

Type: `object`

A schema for serializing JSON responses. See the
[`Serialization` documentation](Serialization.md)
for details.

```js
app.route({
  method: 'GET',
  path: '/',
  responseSchema: {
    200: {
      hello: { type: 'string' }
    }
  },
  handler: function(req, res) {
    res.send({ hello: 'world' });
  }
});
```

#### `config`

Type: `any`

Custom configuration data that can be accessed as `res.config` during the request.

```js
app.route({
  method: 'GET',
  path: '/',
  config: { confValue: 22 },
  handler: function(req, res) {
    res.config // { confValue: 22 }
  }
});
```

A more useful example:

```js
app.route({
  method: 'GET',
  path: '/',
  config: {
    greetings: {
      en: 'Hello world',
      es: 'Hola mundo'
    }
  },
  handler: function(req, res) {
    const lang = getLang(req); // (Example helper function)
    const greeting = res.config.greetings[lang];
    res.send(greeting);
  }
});
```

## Shorthand Methods

```js
app.get(path, [options,] handler)
app.head(path, [options,] handler)
app.post(path, [options,] handler)
app.put(path, [options,] handler)
app.patch(path, [options,] handler)
app.delete(path, [options,] handler)
app.options(path, [options,] handler)

// Registers a route that handles all supported methods
app.all(path, [options,] handler)
```

`options` is the same as the [route options](#options), but without the
`method`, `path`, and `handler` options (since those are specified by the
function name and the `path`/`handler` parameters).

```js
app.get('/', (req, res) => {
  res.send('hello world');
});

app.post('/hello', {
  preHandler: [
    function authenticate(req, res, next) { },
    function validate(req, res, next) { },
  ],
  responseSchema: {
    200: {
      hello: { type: 'string' }
    }
  }
}, (req, res) => {
  res.send({ hello: 'world' });
});
```

If the `options` parameter is an array, it will be treated as an array
of [preHandlers](#prehandler).

```js
function authenticate(req, res, next) {
  // Authenticate a user
}
function validate(req, res, next) {
  // Validate the request
}

app.get('/', [authenticate, validate], (req, res) => {
  res.send({ hello: 'world' });
});
```

The `handler` may be specified in the `options` object if the third parameter is omitted:

```js
app.get('/path', {
  preHandler: [ /* ... */ ],
  responseSchema: { /* ... */ },
  handler: function(req, res) {
    res.send();
  }
});
```

*If the `handler` is specified in both the `options` object and as the
third parameter, the third parameter will take precedence.*

## URL-Building

Medley supports any route paths supported by
[`find-my-way`](https://github.com/delvedor/find-my-way).

URL parameters are specified with a colon (`:`) before the parameter
name, and wildcard paths use an asterisk (`*`).

_Note that static routes are always checked before parametric and wildcard routes._

```js
// Static
app.get('/api/user', (req, res) => {});

// Parametric
app.get('/api/:userId', (req, res) => {});
app.get('/api/:userId/:secretToken', (req, res) => {});

// Wildcard
app.get('/api/*', (req, res) => {});
```

Regular expression routes are also supported, but be aware that they are
expensive in terms of performance.

```js
// Parametric with regex
app.get('/api/:file(^\\d+).png', (req, res) => {});
```

To define a path with more than one parameter within the same path part,
a hyphen (`-`) can be used to separate the parameters:

```js
// Multi-parametric
app.get('/api/near/:lat-:lng/radius/:r', (req, res) => {
  // Matches: '/api/near/10.856-32.284/radius/50'
  req.params // { lat: '10.856', lng: '32.284', r: '50' }
});
```

Multiple parameters also work with regular expressions:

```js
app.get('/api/at/:hour(^\\d{2})h:minute(^\\d{2})m', (req, res) => {
  // Matches: '/api/at/02h:50m'
  req.params // { hour: '02', minute: '50' }
});
```

In this case, the parameter separator can be any character that is not
matched by the regular expression.

Having a route with multiple parameters may affect negatively the performance,
so prefer the single parameter approach whenever possible.

For more information on the router used by Medley, check out
[`find-my-way`](https://github.com/delvedor/find-my-way).

<a id="async-await"></a>
## Async-Await / Promises

Medley has a convenient feature for `async` functions. If an `async` function returns a value,
it will be sent automatically.

```js
app.get('/', async (req, res) => {
  const data = await getDataAsync();
  return data;
});

// Which is the same as:
app.get('/', async (req, res) => {
  const data = await getDataAsync();
  res.send(data);
});
```

This means that using `async-await` might not be needed at all since awaitable
functions return a promise, which can be returned from a normal function:

```js
app.get('/', (req, res) => {
  return getDataAsync();
});
```

The default status code for responses is `200`. If needed, use `res.status()`
or `res.statusCode` to set the status code before returning:

```js
app.post('/user', (req, res) => {
  res.statusCode = 201; // For a "201 Created" response
  return createUserAsync();
});
```

Note that no response will be sent if the value returned from an `async`
function is `undefined`. This is because returning `undefined` is the same
as not returning anything all (see the
[MDN `return` documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return#wikiArticle)).

**Warning:** An error will be thrown if `return value` and `res.send()`
are used at the same time because a response cannot be sent twice.

## Route Prefixing

Sometimes it is necessary to maintain two or more different versions of the same API. A classic
approach is to prefix a set of routes with the API version number, `/v1` for example. A simple
way to accomplish this would be to include the prefix in every route declaration:

```js
app.get('/v1/user', (req, res) => { ... })
```

But an alternative would be to use [`app.createSubApp()`](App.md#createsubapp) to create separate
sub-apps with a different prefix for each group of routes:

**app.js**
```js
const medley = require('@medley/medley');
const app = medley();

app.createSubApp('/v1').register(require('./routes/v1/user'));
app.createSubApp('/v2').register(require('./routes/v2/user'));

app.listen(3000);
```

**./routes/v1/user.js**
```js
module.exports = function v1Routes(subApp) {
  subApp.get('/user', (req, res) => {
    // v1 implementation
  });
};
```

**./routes/v2/user.js**
```js
module.exports = function v2Routes(subApp) {
  subApp.get('/user', (req, res) => {
    // v2 implementation
  });
};
```

Now the following routes will be defined, each with a different implementation:

+ `/v1/user`
+ `/v2/user`
