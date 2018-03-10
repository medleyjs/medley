# Reply

Request is a core Medley object that is passed as the second argument to hooks and handlers.

**Properties:**

+ [`.config`](#replyconfig)
+ [`.res`](#replyres)
+ [`.sent`](#replysent)

**Methods:**

+ [`.code(statusCode)`](#code)
+ [`.getHeader(name)`](#get-header)
+ [`.setHeader(name, value)`](#set-header)
+ [`.appendHeader(name, value)`](#append-header)
+ [`.type(contentType)`](#type)
+ [`.redirect([statusCode,] url)`](#redirect)
+ [`.error(err)`](#error)
+ [`.send([payload])`](#send)


## Properties

### `reply.config`

The value of the `config` option passed to [`app.route()`](Reply.md#options)
(or one of it's shorthand methods). Defaults to an empty object `{}`.

### `reply.res`

The native [`http.ServerResponse`](https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_serverresponse)
from Node core.

### `reply.sent`

A boolean value that indicates whether or not a response has already been sent.


## Methods

<a id="code"></a>
### `reply.code(statusCode)`

+ `statusCode` (number)

Sets the HTTP status code for the response. If not set, the status code for
the response defaults to `200`.

<a id="get-header"></a>
### `reply.getHeader(name)`

+ `name` (string)
+ Returns: (string|string[])

Gets a response header.

```js
reply.getHeader('Content-Type') // 'application/json'
```

<a id="set-header"></a>
### `reply.setHeader(name, value)`

+ `name` (string)
+ `value` (string|string[])

Sets a response header.

```js
reply.setHeader('Content-Encoding', 'gzip')
```

For more information, see [`http.ServerResponse#setHeader`](https://nodejs.org/dist/latest/docs/api/http.html#http_response_setheader_name_value).

<a id="append-header"></a>
### `reply.appendHeader(name, value)`

+ `name` (string)
+ `value` (string|string[])

Sets a response header if not already set. Appends the value to the header as an array if it already exists.

```js
reply.appendHeader('Set-Cookie', 'foo=bar')
reply.getHeader('Set-Cookie') // 'foo=bar'
reply.appendHeader('Set-Cookie', 'bar=baz; Path=/; HttpOnly')
reply.getHeader('Set-Cookie') // ['foo=bar', 'bar=baz; Path=/; HttpOnly']
```

This is only needed for setting multiple `Set-Cookie` headers.

<a id="type"></a>
### `reply.type(contentType)`

+ `contentType` (string)

Sets the `Content-Type` header for the response.

```js
reply.type('text/html')
```

This is a shortcut for: `reply.setHeader('Content-Type', contentType)`.

<a id="redirect"></a>
### `reply.redirect([statusCode,] url)`

+ `statusCode` (number) - The HTTP status code for the response. Defaults to `302`.
+ `url` (string) - The URL to which the client will be redirected.

Redirects a request to the specified URL.

```js
// "302 Found" redirect
reply.redirect('/home')

// With statusCode
reply.redirect(301, '/moved-permanently')
```

<a id="error"></a>
### `reply.error(err)`

+ `err` ([Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error))

Sends an error response.

```js
app.get('/', function(request, reply) {
  asyncFn((err, data) => {
    if (err) {
      reply.error(err)
    } else {
      reply.send(data)
    }
  })
})
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

The status code for the response is chosen in the following order:

1. The `status` property on the error object if it is >= `400`.
1. The `statusCode` property on the error object if it is >= `400`.
1. The current status code for the request (set with `reply.code()`) if it is >= `400`.
1. If none of the above, `500` is used.

Tip: The [`http-errors`](https://npm.im/http-errors) module can be used to simplify generating errors:

```js
app.get('/', (request, reply) => {
  reply.error(httpErrors.Gone())
})
```

Errors with a `status` or `statusCode` property equal to `404` cause the not-found handler
(set with [`app.setNotFoundHandler()`](Server-Methods.md#setnotfoundhandler)) to be invoked.

```js
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send('Custom 404 response')
})

app.get('/', (request, reply) => {
  reply.error(new httpErrors.NotFound())
})
```

<a id="send"></a>
### `reply.send([payload])`

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
}, (request, reply) => {
  reply.send({ hello: 'world' })
})

// Send a string as JSON
app.get('/json-string', (request, reply) => {
  reply.type('application/json').send('Hello world!')
})
```

#### String

If not already set, the `Content-Type` header will be set to `'text/plain'`.

```js
app.get('/text', options, (request, reply) => {
  reply.send('plain text')
})
```

If the `Content-Type` header is set to `'application/json'`, the string is serialized as JSON.

```js
app.get('/json-string', (request, reply) => {
  reply.type('application/json').send('Hello world!')
  // Sends: "Hello world!"
})
```

#### Buffer

If not already set, the `Content-Type` header will be set to `'application/octet-stream'`.

```js
const fs = require('fs')

app.get('/buffer', (request, reply) => {
  fs.readFile('some-file', (err, fileBuffer) => {
    if (err) {
      reply.error(err)
    } else {
      reply.send(fileBuffer) 
    }
  })
})
```

#### Stream

If not already set, the `Content-Type` header will be set to `'application/octet-stream'`.

```js
const fs = require('fs')

app.get('/stream', (request, reply) => {
  const stream = fs.createReadStream('some-file', 'utf8')
  reply.send(stream)
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

If an `async` function returns a value (other than `undefined`), `reply.send()`
will be called automatically with the value.

```js
app.get('/', async (request, reply) => {
  const user = await loadUser()
  return user
})
// Is the same as:
app.get('/', (request, reply) => {
  const user = await loadUser()
  reply.send(user)
})
```

This means that using `await` isn't always necessary since promises that resolve
to a value can be returned to have the value automatically sent.

```js
app.get('/', (request, reply) => { // no `async` (since `await` isn't used)
  return loadUser() // no `await`
})
```

If an error is throw inside an `async` function, `reply.error()` is called
automatically with the error.

```js
app.get('/', async (request, reply) => {
  throw new Error('async error')
})
// Is the same as:
app.get('/', (request, reply) => {
  reply.error(new Error('async error'))
})
```

See [Routes#async-await](Routes.md#async-await) for more examples.
