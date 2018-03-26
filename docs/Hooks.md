# Hooks

Hooks are functions that run during different parts of the request [lifecycle](Lifecycle.md).
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

Check out the [lifecycle docs](Lifecycle.md) to see where each hook is executed
in the request lifecycle.

Hooks follow Medley's encapsulation model, and can thus be scoped to specific routes.
See the [Encapsulation](#encapsulation) section for more information.

<a id="onRequest-preHandler-hooks"></a>
## The `onRequest` and `preHandler` Hooks

```js
// Callback version
app.addHook('onRequest', (req, res, next) => {
  // Handle onRequest
  next();
});

app.addHook('preHandler', (req, res, next) => {
  // Handle preHandler
  next();
});

// Async version
app.addHook('onRequest', async (req, res) => {
  // Handle onRequest
});

app.addHook('preHandler', async (req, res) => {
  // Handle preHandler
});
```

+ `req` - Medley [Request](Request.md) object.
+ `res` - Medley [Response](Response.md) object.
+ `next([error])` - Function to continue to the next hook.

`onRequest` hooks are executed at the very beginning of each request and `preHandler` hooks are
executed before the route handler is invoked (see the [Lifecycle docs](Lifecycle.md) for details).

These hooks are similar to Express middleware.

If the hook is an `async` function (or it returns a promise), the `next`
callback should **not** be used. The request will continue to the next hook
when the async hook ends or throws (or the promise resolves or rejects).

### `beforeHandler`

Functions passed as the `beforeHandler` option to [`app.route()`](Routes.md#route-method)
have exactly the same signature as `preHandler` hooks and are executed immediately after
any `preHandler` hooks. This is similar to route-level middleware in Express.

```js
app.route({
  method: 'GET',
  path: '/',
  beforeHandler(req, res, next) {
    // Do something, like authorization
    next();
  },
  handler(req, res) {
    res.send({ hello: 'user' });
  }
});
```

### Sending a Response

It is possible to respond to a request within the `onRequest` and `preHandler`
hooks. This will skip the rest of the `onRequest` and `preHandler` hooks and
the route handler.

```js
app.addHook('preHandler', (req, res, next) => {
  res.send({ early: 'response' });
});
```

If sending a response from inside a hook, **`next()` must not be called**.

If sending a response from inside an `async` hook, `res.send()` must be used.
If it is not, Medley will not know that a response has been sent so the hooks
will continue running.

### Handling Errors

If an error occurs during the execution of a hook, it should be passed to
`next()` to end the hook execution and trigger an error response. The
error will be handled by [`Response#error()`](Response.md#error).

```js
const fs = require('fs');

app.addHook('onRequest', (req, res, next) => {
  fs.readFile('./someFile.txt', (err, buffer) => {
    if (err) {
      next(err);
      return;
    }
    // Do something with the buffer
  });
});
```

Async-await/promise errors are automatically caught and handled by Medley.

```js
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

app.addHook('onRequest', async (req, res) => {
  const buffer = await fs.readFile('./someFile.txt');
  // Do something with the buffer
});
```

<a id="onSend-hook"></a>
## The `onSend` Hook

```js
// Callback version
app.addHook('onSend', (req, res, payload, next) => {
  // Handle onSend
  next();
});

// Async version
app.addHook('onSend', async (req, res, payload) => {
  // Handle onSend
});
```

+ `req` - Medley [Request](Request.md) object.
+ `res` - Medley [Response](Response.md) object.
+ `payload` - The serialized payload.
+ `next([error [, payload]])` - Function to continue to the next hook and optionally update the payload.

The `onSend` hooks are run right after `res.send()` is called and the payload
has been serialized. They provide an opportunity to save application state
(e.g. sessions) and set extra headers before the response is sent.

### Modifying the Payload

It is possible to modify the payload before it is sent by passing the modified
payload as the second argument to `next()`. The payload may only be changed
to a `string`, a `Buffer`, a `stream`, or `null`.

```js
app.get('/', (req, res) => {
  res.send({ hello: 'world' });
});

app.addHook('onSend', (req, res, payload, next) => {
  console.log(payload); // '{"hello":"world"}'
  const newPayload = Buffer.from(payload);
  next(null, newPayload);
});
```

To modify the payload using an `async` hook, return the new payload:

```js
app.addHook('onSend', async (req, res, payload) => {
  return Buffer.from(payload);
});
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
app.addHook('onFinished', (req, res) => {
  // Handle onFinished
});
```

+ `req` - Medley [Request](Request.md) object
+ `res` - Medley [Response](Response.md) object

The `onFinished` hook is different from the other hooks. It only receives the
[`req`](Request.md) and [`res`](Response.md) objects and is executed synchronously.
Any errors that occur during this hook must be handled manually.

```js
app.addHook('onFinished', async (req, res) => {
  try {
    await asyncFunction();
  } catch (error) {
    // Handle error
  }
});
```

`onFinished` hooks are run once the response has finished sending (or if the underlying
connection was terminated before the response could finish sending).

<a id="encapsulation"></a>
## Hooks Encapsulation

Hooks can be encapsulated following Medley's sub-app encapsulation model so
that they will only run on routes in the same encapsulation scope.

```js
app.addHook('onRequest', (req, res, next) => {
  req.top = true; // Runs for all routes
  next();
});

app.use((subApp1) => {
  subApp1.addHook('onRequest', (req, res, next) => {
    req.one = 1; // Only runs for routes in `subApp1`
    next();
  });

  subApp1.get('/route-1', (req, res) => {
    console.log(req.top); // true
    console.log(req.one); // 1
    console.log(req.two); // undefined
    res.send();
  });
});

app.use((subApp2) => {
  subApp2.addHook('onRequest', (req, res, next) => {
    req.two = 2; // Only runs for routes in `subApp2`
    next();
  });

  subApp2.get('/route-2', (req, res) => {
    console.log(req.top); // true
    console.log(req.one); // undefined
    console.log(req.two); // 2
    res.send();
  });
});
```
