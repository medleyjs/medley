# Response

Request is a core Medley object that is passed as the second argument to hooks and handlers.
It is a wrapper around Node's [`http.ServerResponse`][http.ServerResponse] object
(unlike in Express, which extends that object).

**Properties:**

+ [`.headersSent`](#resheaderssent)
+ [`.request`](#resrequest)
+ [`.route`](#resroute)
+ [`.sent`](#ressent)
+ [`.statusCode`](#resstatuscode)
+ [`.stream`](#resstream)

**Methods:**

+ [`.append(field, value)`](#append)
+ [`.error([statusCode,] error)`](#error)
+ [`.get(field)`](#get)
+ [`.notFound()`](#not-found)
+ [`.redirect([statusCode,] url)`](#redirect)
+ [`.remove(field)`](#remove)
+ [`.send([payload])`](#send)
+ [`.set(field [, value])`](#set)
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
})
```

### `res.sent`

Boolean. `true` if a response has already been sent, `false` otherwise.

### `res.statusCode`

The HTTP status code that will be sent to the client when the response is sent.<br>
Defaults to `200`.

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

<a id="append"></a>
### `res.append(field, value)`

+ `field` *(string)*
+ `value` *(string|string[])*
+ Chainable
+ Alias: `res.appendHeader()`

Appends the `value` to the HTTP response header `field`. If the header is not
already set, it creates the header with the specified `value`.

```js
res.append('set-cookie', 'foo=bar')
res.get('set-cookie') // 'foo=bar'
res.append('set-cookie', 'bar=baz; Path=/; HttpOnly')
res.get('set-cookie') // ['foo=bar', 'bar=baz; Path=/; HttpOnly']
```

Note that calling `res.set()` after `res.append()` will reset the previously set header value.

<a id="error"></a>
### `res.error([statusCode,] error)`

+ `error` *([Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error))*
+ `statusCode` *(number)* - The status code for the response. See [below](#error-status-code) for the default value.

Sends an error response.

```js
app.get('/', function(req, res) {
  getData((err, data) => {
    if (err) {
      res.error(err)
    } else {
      res.send(data)
    }
  })
})
```

With a specific status code:

```js
res.error(400, error)
```

If a custom error handler (set with [`app.setErrorHandler()`](App.md#set-error-handler)) is
associated with the route, it is invoked. Otherwise the following default JSON response will be sent:

```js
{
  error: String      // The HTTP error message for the status code
  message: String    // The error message (on the error object)
  statusCode: Number // The error status code
}
```

#### Error Status Code

The status code for the response is chosen in the following order:

1. The `statusCode` parameter passed to the method.
1. The `status` property on the error object.
1. The `statusCode` property on the error object.
1. If none of the above, `500` is used.

**Note:** The status code must be between `200` and `599` (inclusive) to be
compatible with HTTP/2.

<a id="get"></a>
### `res.get(field)`

+ `field` *(string)*
+ Returns: *(string|string[])*
+ Alias: `response.getHeader()`

Gets a previously set response header.

```js
res.get('content-type') // 'application/json'
```

**Tip:** While not required, it is best to use lowercase header names for the best performance
and for consistency with HTTP/2 (which requires header names to be lowercase).

<a id="not-found"></a>
### `res.notFound()`

Forwards the request to the not-found handler (either the default or one set
with [`app.setNotFoundHandler()`](App.md#set-not-found-handler)).

```js
app.setNotFoundHandler((req, res) => {
  res.status(404).send(req.url + ' not found')
})

app.get('/never-found', (req, res) => {
  res.notFound()
})
```

<a id="redirect"></a>
### `res.redirect([statusCode,] url)`

+ `statusCode` *(number)* - The HTTP status code for the response. Defaults to `302`.
+ `url` *(string)* - The URL to which the client will be redirected.

Redirects a request to the specified URL.

```js
// "302 Found" redirect
res.redirect('/home')

// With statusCode
res.redirect(301, '/moved-permanently')
```

<a id="remove"></a>
### `res.remove(field)`

+ `field` *(string)*
+ Chainable
+ Alias: `res.removeHeader()`

Removes a response header.

```js
res.remove('content-type')
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
  const stream = fs.createReadStream('some-file')
  res.send(stream)
})
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
  res.send({ hello: 'world' })
})
```

#### Async-Await / Promises

If an `async` function returns a value (other than `undefined`), `res.send()`
will be called automatically with the value.

```js
app.get('/', async (req, res) => {
  const user = await loadUser()
  return user
})
// Is the same as:
app.get('/', async (req, res) => {
  const user = await loadUser()
  res.send(user)
})
```

This means that using `await` isn't always necessary since promises that resolve
to a value can be returned to have the value automatically sent. The example
above could be rewritten as:

```js
app.get('/', (req, res) => { // No `async` (since `await` isn't used)
  return loadUser()
})
```

If an error is thrown inside an `async` function, `res.error()` is called
automatically with the error.

```js
app.get('/', async (req, res) => {
  throw new Error('async error')
})
// Is the same as:
app.get('/', (req, res) => {
  res.error(new Error('async error'))
})
```

See [Routes#async-await](Routes.md#async-await) for more examples.

<a id="set"></a>
### `res.set(field [, value])`

+ `field` *(string|object)*
+ `value` *(string|string[])*
+ Chainable
+ Alias: `res.setHeader()`

Sets a response HTTP header. If the header already exists, its value will be replaced.
Use an array of strings to set multiple headers for the same field.

```js
res.set('content-encoding', 'gzip')
res.set('set-cookie', ['user=medley', 'session=123456'])
```

Multiple headers can be set at once by passing an object as the `field` parameter:

```js
res.set({
  'content-type': 'text/plain',
  'etag': '123456'
});
```

**Tip:** While not required, it is best to use lowercase header names for the best performance
and for consistency with HTTP/2 (which requires header names to be lowercase).

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

This is a shortcut for: `res.set('content-type', contentType)`.

[http.ServerResponse]: https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_serverresponse
