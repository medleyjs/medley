# Response

Request is a core Medley object that is passed as the second argument to hooks and handlers.
It is a wrapper around Node's [`http.ServerResponse`][http.ServerResponse] object.

**Properties:**

+ [`.config`](#responseconfig)
+ [`.res`](#responseres)
+ [`.sent`](#responsesent)

**Methods:**

+ [`.appendHeader(name, value)`](#append-header)
+ [`.error([statusCode,] error)`](#error)
+ [`.getHeader(name)`](#get-header)
+ [`.redirect([statusCode,] url)`](#redirect)
+ [`.removeHeader(name)`](#remove-header)
+ [`.send([payload])`](#send)
+ [`.setHeader(name, value)`](#set-header)
+ [`.status(statusCode)`](#status)
+ [`.type(contentType)`](#type)


## Properties

### `response.config`

The value of the `config` option passed to [`app.route()`](Response.md#options)
(or one of it's shorthand methods). Defaults to an empty object `{}`.

### `response.res`

The native [`http.ServerResponse`][http.ServerResponse] object from Node core.

### `response.sent`

A boolean value that indicates whether or not a response has already been sent.


## Methods

<a id="append-header"></a>
### `response.appendHeader(name, value)`

+ `name` *(string)*
+ `value` *(string|string[])*
+ Chainable

Sets a response header if not already set. Appends the value to the header as an array if it already exists.

```js
response.appendHeader('set-cookie', 'foo=bar')
response.getHeader('set-cookie') // 'foo=bar'
response.appendHeader('set-cookie', 'bar=baz; Path=/; HttpOnly')
response.getHeader('set-cookie') // ['foo=bar', 'bar=baz; Path=/; HttpOnly']
```

<a id="error"></a>
### `response.error([statusCode,] error)`

+ `error` *([Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error))*
+ `statusCode` *(number)* - The status code for the response. See [below](#error-status-code) for the default value.

Sends an error response.

```js
app.get('/', function(request, response) {
  asyncFn((err, data) => {
    if (err) {
      response.error(err)
    } else {
      response.send(data)
    }
  })
})
```

With a specific status code:

```js
response.error(400, error)
```

If a custom error handler (set with [`app.setErrorHandler()`](Server-Methods.md#seterrorhandler)) is
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

If the `statusCode` is `404`, the not-found handler (either the default, or a custom
handler set with [`app.setNotFoundHandler()`](Server-Methods.md#setnotfoundhandler))
will be invoked instead of the error handler.

```js
// Using the http-errors module (https://www.npmjs.com/package/http-errors)
response.error(new httpErrors.NotFound())

// Just the statusCode
response.error(404, null) // Pass `null` as the error since it cannot be `undefined`
```

<a id="get-header"></a>
### `response.getHeader(name)`

+ `name` *(string)*
+ Returns: *(string|string[])*

Gets a response header.

```js
response.getHeader('content-type') // 'application/json'
```

**Tip:** Always use lowercase header names for the best performance and for future
compatibility with HTTP 2 (which requires header names to be lowercase).

<a id="redirect"></a>
### `response.redirect([statusCode,] url)`

+ `statusCode` *(number)* - The HTTP status code for the response. Defaults to `302`.
+ `url` *(string)* - The URL to which the client will be redirected.

Redirects a request to the specified URL.

```js
// "302 Found" redirect
response.redirect('/home')

// With statusCode
response.redirect(301, '/moved-permanently')
```

<a id="remove-header"></a>
### `response.removeHeader(name)`

+ `name` *(string)*
+ Chainable

Removes a response header.

```js
response.removeHeader('content-type')
```

<a id="send"></a>
### `response.send([payload])`

Sends the payload to respond to the request. It may be called without any arguments to
respond without sending a payload.

`.send()` handles payloads differently based on their type. The behavior for each type
is described below.

Note that if the `Content-Type` header is set before `.send()` is called, the payload
will be sent as-is (unless the `Content-Type` header was set to `application/json`,
in which case it will be serialized as JSON).

#### JSON

The payload will be JSON-serialized by default if it is not a `string`, `Buffer`, or `stream`.
To force a `string` to be serialized as JSON, set the `Content-Type` header to `application/json`
before sending the payload.

JSON payloads are serialized with [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify)
if a response schema was set, otherwise `JSON.stringify()` is used.

```js
app.get('/json', {
  responseSchema: {
    200: {
      hello: { type: 'string' }
    }
  }
}, (request, response) => {
  response.send({ hello: 'world' })
})

// Send a string as JSON
app.get('/json-string', (request, response) => {
  response.type('application/json').send('Hello world!')
})
```

#### String

If not already set, the `Content-Type` header will be set to `'text/plain'`.

```js
app.get('/text', options, (request, response) => {
  response.send('plain text')
})
```

If the `Content-Type` header is set to `'application/json'`, the string is serialized as JSON.

```js
app.get('/json-string', (request, response) => {
  response.type('application/json').send('Hello world!')
  // Sends: "Hello world!"
})
```

#### Buffer

If not already set, the `Content-Type` header will be set to `'application/octet-stream'`.

```js
const fs = require('fs')

app.get('/buffer', (request, response) => {
  fs.readFile('some-file', (err, fileBuffer) => {
    if (err) {
      response.error(err)
    } else {
      response.send(fileBuffer) 
    }
  })
})
```

#### Stream

If not already set, the `Content-Type` header will be set to `'application/octet-stream'`.

```js
const fs = require('fs')

app.get('/stream', (request, response) => {
  const stream = fs.createReadStream('some-file', 'utf8')
  response.send(stream)
})
```

#### Type of the final payload

The type of the payload (after serialization and going through any [`onSend` hooks](Hooks.md#the-onsend-hook))
must be one of the following types:

+ `string`
+ `Buffer`
+ `stream`
+ `null`
+ `undefined`

An error will be thrown if the payload is not one of these types.

#### Async-Await / Promises

If an `async` function returns a value (other than `undefined`), `response.send()`
will be called automatically with the value.

```js
app.get('/', async (request, response) => {
  const user = await loadUser()
  return user
})
// Is the same as:
app.get('/', (request, response) => {
  const user = await loadUser()
  response.send(user)
})
```

This means that using `await` isn't always necessary since promises that resolve
to a value can be returned to have the value automatically sent.

```js
app.get('/', (request, response) => { // no `async` (since `await` isn't used)
  return loadUser() // no `await`
})
```

If an error is throw inside an `async` function, `response.error()` is called
automatically with the error.

```js
app.get('/', async (request, response) => {
  throw new Error('async error')
})
// Is the same as:
app.get('/', (request, response) => {
  response.error(new Error('async error'))
})
```

See [Routes#async-await](Routes.md#async-await) for more examples.

<a id="set-header"></a>
### `response.setHeader(name, value)`

+ `name` *(string)*
+ `value` *(string|string[])*
+ Chainable

Sets a response header. If the header already exists, its value will be replaced.
Use an array of strings to set multiple headers with the same name.

```js
response.setHeader('content-encoding', 'gzip')

response.setHeader('set-cookie', ['user=medley', 'session=123456'])
```

**Tip:** Always use lowercase header names for the best performance and for future
compatibility with HTTP 2 (which requires header names to be lowercase).

<a id="status"></a>
### `response.status(statusCode)`

+ `statusCode` *(number)*
+ Chainable

Sets the HTTP status code for the response. If not set, the status code for
the response defaults to `200`.

**Note:** The status code must be between `200` and `599` (inclusive) to be
compatible with HTTP 2.

<a id="type"></a>
### `response.type(contentType)`

+ `contentType` *(string)*
+ Chainable

Sets the `Content-Type` header for the response.

```js
response.type('text/html')
```

This is a shortcut for: `response.setHeader('content-type', contentType)`.

[http.ServerResponse]: https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_serverresponse
