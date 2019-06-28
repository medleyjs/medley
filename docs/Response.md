# Response

Response is a core Medley object that is passed as the second argument to hooks and handlers.
It is a wrapper around Node's [`http.ServerResponse`][http.ServerResponse] object
(unlike in Express, which extends that object).

This documentation refers to Response instances as `res`, although the object could be named
anything (e.g. `response`) since it is always received as a function parameter.

```js
app.get('/user/:id', function(req, res) {
  res.send('User ' + req.params.id);
});
```

**Properties:**

+ [`.headersSent`](#resheaderssent)
+ [`.request`](#resrequest)
+ [`.route`](#resroute)
+ [`.sent`](#ressent)
+ [`.state`](#resstate)
+ [`.statusCode`](#resstatuscode)
+ [`.stream`](#resstream)

**Methods:**

+ [`.appendHeader(field, value)`](#appendHeader)
+ [`.error([statusCode,] error)`](#error)
+ [`.getHeader(field)`](#getHeader)
+ [`.hasHeader(field)`](#hasHeader)
+ [`.redirect([statusCode,] url)`](#redirect)
+ [`.removeHeader(field)`](#removeHeader)
+ [`.send([payload])`](#send)
+ [`.setHeader(field [, value])`](#setHeader)
+ [`.status(statusCode)`](#status)
+ [`.type(contentType)`](#type)


## Properties

### `res.headersSent`

Boolean (read-only). `true` if headers have already been sent, `false` otherwise.

### `res.request`

A reference to the [`request`](Request.md) object for the current request.

### `res.route`

The Medley data associated with the current route. Exposed to provide access to
the `config` object passed to the [`app.route()`](Response.md#options) method
(or one of it's shorthands). Could also be useful for debugging.

```js
app.route({
  method: 'GET',
  path: '/user',
  config: { confValue: 22 },
  handler: function(req, res) {
    res.route.config // { confValue: 22 }
  }
});
```

### `res.sent`

Boolean. `true` if a response has already been sent, `false` otherwise.

### `res.state`

A plain object for storing arbitrary data during a request. Recommended to be
used as a namespace for passing information through hooks to front-end views.
Is a new, empty object for each request.

```js
res.state // {}
```

### `res.statusCode`

The HTTP status code that will be sent to the client when the response is sent.<br>
Defaults to `200`.

```js
res.statusCode // 200
res.statusCode = 201
```

**Note:** The status code must be between `200` and `599` (inclusive) to be
compatible with HTTP/2.

### `res.stream`

The [writable stream](https://nodejs.org/api/stream.html#stream_writable_streams)
of the outgoing response that can be used to send data to the client. This is the
[`http.ServerResponse`][http.ServerResponse] ("res") object from Node core. If
the server is using HTTP/2, this will instead be an instance of
[`http2.Http2ServerResponse`](https://nodejs.org/api/http2.html#http2_class_http2_http2serverresponse).

This object generally should never need to be used. Writing to the stream
directly instead of using [`res.send()`](#send) will bypass Medley's internal
response handling and prevent `onSend` hooks from being run. It is also a
good idea to avoid using [`http.ServerResponse`][http.ServerResponse] methods
on the object, like `.writeHead()` and `.getHeaders()`, so that your code can
be compatible with future versions of Medley that will use Node's new
[HTTP/2 stream interface](https://nodejs.org/api/http2.html#http2_class_http2stream).
Additionally, using the `.[get|set]Header()` methods available on this object
is not supported by Medley and may cause undefined behavior.


## Methods

<a id="appendHeader"></a>
### `res.appendHeader(name, value)`

+ `name` *(string)*
+ `value` *(string|string[])*
+ Chainable
+ Alias: `res.append()`

Appends the `value` to the HTTP response header. If the header is not
already set, this is the same as calling [`res.setHeader()`](#setHeader).

```js
res.appendHeader('set-cookie', 'foo=bar')
res.getHeader('set-cookie') // 'foo=bar'
res.appendHeader('set-cookie', 'bar=baz; Path=/; HttpOnly')
res.getHeader('set-cookie') // ['foo=bar', 'bar=baz; Path=/; HttpOnly']
```

Note that calling `res.setHeader()` after `res.appendHeader()` will overwrite the header value.

<a id="error"></a>
### `res.error([statusCode,] error)`

+ `error` *([Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error))*
+ `statusCode` *(number)* - The status code for the error.

Invokes the [`onError` hooks](Hooks.md#onError-hook) to send an error response.

```js
app.get('/', function(req, res) {
  getData((err, data) => {
    if (err) {
      res.error(err);
    } else {
      res.send(data);
    }
  });
});
```

If the status code parameter is used, it will be attached to the error.

```js
res.error(400, err)

// Which is really just a convenience for:
err.status = 400
res.error(err)
```

<a id="getHeader"></a>
### `res.getHeader(name)`

+ `name` *(string)*
+ Returns: *(string|string[])*
+ Alias: `res.get()`

Gets a previously set response header.

```js
res.getHeader('content-type') // 'application/json'
```

**Tip:** While not required, using lowercase header names is better for performance
and for consistency with HTTP/2 (which always sends header names in lowercase).

<a id="hasHeader"></a>
### `res.hasHeader(name)`

+ `name` *(string)*
+ Returns: *(boolean)*
+ Alias: `res.has()`

Returns `true` if the specified response header was previously set, otherwise returns `false`.

```js
res.hasHeader('content-type') // false
res.setHeader('content-type', 'application/json')
res.hasHeader('content-type') // true
```

<a id="redirect"></a>
### `res.redirect([statusCode,] url)`

+ `statusCode` *(number)* - The HTTP status code for the response. Defaults to `302`.
+ `url` *(string)* - The URL to which the client will be redirected.

Redirects a request to the specified URL.

```js
// "302 Found" redirect
res.redirect('/home');

// With statusCode
res.redirect(301, '/moved-permanently');
```

<a id="removeHeader"></a>
### `res.removeHeader(name)`

+ `name` *(string)*
+ Chainable
+ Alias: `res.remove()`

Removes a response header.

```js
res.removeHeader('content-type')
```

<a id="send"></a>
### `res.send([payload])`

Sends the payload to respond to the request.

`.send()` handles payloads differently based on their type. The behavior for each type
is described below.

#### No Value / `null` / `undefined`

Sends a response with an empty body.

```js
res.send()
res.send(null)
res.send(undefined)
```

#### String

If not already set, the `Content-Type` header will be set to `'text/plain'`.

```js
res.send('plain text')
```

#### Buffer

If not already set, the `Content-Type` header will be set to `'application/octet-stream'`.

```js
res.send(Buffer.from('a message'))
```

#### Stream

If not already set, the `Content-Type` header will be set to `'application/octet-stream'`.

```js
const fs = require('fs')

app.get('/stream', (req, res) => {
  const stream = fs.createReadStream('some-file');
  res.send(stream);
});
```

#### JSON

If the payload is not one of the previous types, it will be JSON-serialized.
If not already set, the `Content-Type` header will be set to `'application/json'`.

JSON payloads are serialized with [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify)
if a response schema was set, otherwise `JSON.stringify()` is used.

```js
app.get('/json', {
  responseSchema: {
    200: {
      hello: { type: 'string' }
    }
  }
}, (req, res) => {
  res.send({ hello: 'world' });
});
```

#### Async-Await / Promises

If an `async` function returns a value (other than `undefined`), `res.send()`
will be called automatically with the value.

```js
app.get('/', async (req, res) => {
  const user = await loadUser();
  return user;
});
// Is the same as:
app.get('/', async (req, res) => {
  const user = await loadUser();
  res.send(user);
});
```

This means that using `await` isn't always necessary since promises that resolve
to a value can be returned to have the value automatically sent. The example
above could be rewritten as:

```js
app.get('/', (req, res) => { // No `async` (since `await` isn't used)
  return loadUser();
});
```

If an error is thrown inside an `async` function, `res.error()` is called
automatically with the error.

```js
app.get('/', async (req, res) => {
  throw new Error('async error');
});
// Is the same as:
app.get('/', (req, res) => {
  res.error(new Error('async error'));
});
```

See [Routes#async-await](Routes.md#async-await) for more examples.

<a id="setHeader"></a>
### `res.setHeader(name [, value])`

+ `name` *(string|object)*
+ `value` *(string|string[])*
+ Chainable
+ Alias: `res.set()`

Sets a response HTTP header. If the header already exists, its value will be replaced.
Supports using an array of strings to set multiple headers with the same same.

```js
res.setHeader('content-encoding', 'gzip')
res.setHeader('set-cookie', ['user=medley', 'session=123456'])
```

Multiple headers can be set at once by passing an object as the `name` parameter:

```js
res.setHeader({
  'content-type': 'text/plain',
  'etag': '123456'
});
```

**Tip:** While not required, using lowercase header names is better for performance
and for consistency with HTTP/2 (which always sends header names in lowercase).

<a id="status"></a>
### `res.status(statusCode)`

+ `statusCode` *(number)*
+ Chainable

Sets the HTTP status code for the response. A chainable shortcut
for setting [`res.statusCode`](#resstatuscode).

```js
res.status(204).send()
```

**Note:** The status code must be between `200` and `599` (inclusive) to be
compatible with HTTP/2.

<a id="type"></a>
### `res.type(contentType)`

+ `contentType` *(string)*
+ Chainable

Sets the `Content-Type` header for the response.

```js
res.type('text/html')
```

This is a shortcut for: `res.setHeader('content-type', contentType)`.

[http.ServerResponse]: https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_serverresponse
