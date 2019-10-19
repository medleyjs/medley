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

The HTTP method(s) the route will run for.

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
    console.log(req.url); // '/user/1003' (for example)
  }
});
````

See the [**Route Path Formats**](#route-path-formats) section for details on the formats
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

// Registers a route that handles all methods in `require('http').METHODS`
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

## Route Path Formats

Medley supports any route path format supported by [`@medley/router`](https://github.com/@medley/router).

The path formats are as follows:

### 1. Static

Static routes match exactly the path provided.

```
/
/about
/api/login
```

### 2. Parametric

Path segments that begin with a `:` denote a parameter and will match anything
up to the next `/` or to the end of the path.

```
/users/:userID
/users/:userID/posts
/users/:userID/posts/:postID
```

Everything after the `:` character will be the name of the parameter in the
`req.params` object.

```js
app.get('/users/:userID', (req, res) => {
  // Request URL: /users/100
  console.log(req.params); // { userID: '100' }
});
```

If multiple routes have a parameter in the same part of the route, the
parameter names must be the same. For example, registering the following two
routes would be an error because the `:id` and `:userID` parameters conflict
with each other:

```
/users/:id
/users/:userID/posts
```

Parameters may start anywhere in the path. For example, the following are valid routes:

```js
'/api/v:version' // Matches '/api/v1'
'/on-:event'     // Matches '/on-click'
```

#### Optional Parameters

Medley also supports optional parameters, which are defined by placing a `?`
character after a parameter at the end of the route path.

```js
app.get('/user/:id?', () => {});
```

Using the optional parameter syntax is really a shorthand for defining three
routes: one with the parameter, and two without the parameter, where one has
the trailing `/` character and the other does not.

```js
// So this:
app.get('/user/:id?', () => {});

// Is a shorthand for this:
app.get('/user', () => {});
app.get('/user/', () => {});
app.get('/user/:id', () => {});
```

### 3. Wildcard

Routes that end with a `*` are wildcard routes. The `*` will match any
characters in the rest of the path, including `/` characters or no characters.

For example, the following route:

```
/static/*
```

will match all of these URLs:

```
/static/
/static/favicon.ico
/static/js/main.js
/static/css/vendor/bootstrap.css
```

The wildcard value will be set in the route `params` object with `'*'` as the key.

```js
app.get('/static/*', (req, res) => {
  if (req.url === '/static/favicon.ico') {
    console.log(req.params); // { '*': 'favicon.ico' }
  } else if (req.url === '/static/') {
    console.log(req.params); // { '*': '' }
  }
});
```

#### Optional Wildcard

Medley also supports optional wildcards, which are defined by placing a `?`
character after the wildcard `*` character.

```js
app.get('/static/*?', () => {});
```

Using the optional wildcard syntax is really a shorthand for defining two
routes: one with the wildcard, and one without the wildcard or trailing
`/` character.

```js
// So this:
app.get('/static/*?', () => {});

// Is a shorthand for this:
app.get('/static', () => {});
app.get('/static/*', () => {});
```

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
