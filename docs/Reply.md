# Reply
The second parameter of the handler function is `Reply`.
Reply is a core Fastify object that exposes the following functions:

- `.code(statusCode)` - Sets the status code.
- `.header(name, value)` - Sets a response header.
- `.type(value)` - Sets the header `Content-Type`.
- `.redirect([code,] url)` - Redirect to the specified url, the status code is optional (default to `302`).
- `.send([payload])` - Sends the response payload for the request.
- `.sent` - A boolean value that you can use if you need to know if `send` has already been called.
- `.res` - The [`http.ServerResponse`](https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_serverresponse) from Node core.

```js
fastify.get('/', options, function (request, reply) {
  // Your code
  reply
    .header('Content-Type', 'application/json')
    .send({ hello: 'world' })
})
```

Additionally, `Reply` provides access to the context of the request:

```js
fastify.get('/', {config: {foo: 'bar'}}, function (request, reply) {
  reply.send('handler config.foo = ' + reply.context.config.foo)
})
```

<a name="code"></a>
### Code
If not set via `reply.code`, the resulting `statusCode` will be `200`.

<a name="header"></a>
### Header
Sets a response header.

For more information, see [`http.ServerResponse#setHeader`](https://nodejs.org/dist/latest/docs/api/http.html#http_response_setheader_name_value).

<a name="redirect"></a>
### Redirect
Redirects a request to the specified url, the status code is optional, default to `302`.
```js
reply.redirect('/home')
```

<a name="type"></a>
### Type
Sets the content type for the response.
This is a shortcut for `reply.header('Content-Type', 'the/type')`.

```js
reply.type('text/html')
```

<a name="send"></a>
### `.send([payload])`

This function is used to send the payload to response to the request. It may be called without any arguments to respond without sending a payload (`reply.send()`).

`.send()` handles payloads differently based on their type. The behavior for each type is described below. However, if the `Content-Type` header is set (and it does not match one of the cases below), the payload will be sent as-is.

#### Sending JSON

The payload will be JSON-serialized by default if it is not a `string`, `buffer`, `stream`, or `Error`. To force a `string` to be serialized as JSON, set the `Content-Type` header to `application/json` before sending the payload.

JSON payloads are serialized with [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify) if a response schema was set, otherwise `JSON.stringify()` is used.

```js
fastify.get('/json', {
  responseSchema: {
    200: {
      type: 'object',
      properties: {
        hello: { type: 'string' }
      }
    }
  }
}, (request, reply) => {
  reply.send({ hello: 'world' })
})

// Send a string as JSON
fastify.get('/json-string', (request, reply) => {
  reply.type('application/json').send('Hello world!')
})
```

<a name="send-string"></a>
#### Strings
If you pass a string to `send` without a `Content-Type`, it will be sent as plain text. If you set the `Content-Type` header and pass a string to `send`, it will be sent unmodified (unless the `Content-Type` header is set to `application/json`, in which case it will be JSON-serialized like an object — see the section above).
```js
fastify.get('/json', options, function (request, reply) {
  reply.send('plain string')
})
```

<a name="send-streams"></a>
#### Streams
*send* can also handle streams out of the box, internally uses [pump](https://www.npmjs.com/package/pump) to avoid leaks of file descriptors. If you are sending a stream and you have not set a `'Content-Type'` header, *send* will set it at `'application/octet-stream'`.
```js
fastify.get('/streams', function (request, reply) {
  const fs = require('fs')
  const stream = fs.createReadStream('some-file', 'utf8')
  reply.send(stream)
})
```

<a name="send-buffers"></a>
#### Buffers
If you are sending a buffer and you have not set a `'Content-Type'` header, *send* will set it to `'application/octet-stream'`.
```js
const fs = require('fs')
fastify.get('/streams', function (request, reply) {
  fs.readFile('some-file', (err, fileBuffer) => {
    reply.send(err || fileBuffer)
  })
})
```

<a name="errors"></a>
#### Errors
If you pass to *send* an object that is an instance of *Error*, Fastify will automatically create an error structured as the following:
```js
{
  error: String        // the http error message
  message: String      // the user error message
  statusCode: Number   // the http status code
}
```
You can add some custom property to the Error object, such as `code` and `headers`, that will be used to enhance the http response.<br>
*Note: If you are passing an error to `send` and the statusCode is less than 400, Fastify will automatically set it at 500.*

Tip: you can simplify errors by using the [`http-errors`](https://npm.im/http-errors) module to generate errors:

```js
fastify.get('/', function (request, reply) {
  reply.send(httpErrors.Gone())
})
```

If you want to completely customize the error response, checkout [`setErrorHandler`](https://github.com/fastify/fastify/blob/error-docs/docs/Server-Methods.md#seterrorhandler) API.

Errors with a `status` or `statusCode` property equal to `404` will be routed to the not found handler.
See [`server.setNotFoundHandler`](https://github.com/fastify/fastify/blob/error-docs/docs/Server-Methods.md#setnotfoundhandler)
API to learn more about handling such cases:

```js
fastify.setNotFoundHandler(function (request, reply) {
  reply.type('text/plain').send('a custom not found')
})

fastify.get('/', function (request, reply) {
  reply.send(new httpErrors.NotFound())
})
```

<a name="payload-type"></a>
#### Type of the final payload
The type of the sent payload (after serialization and going through any [`onSend` hooks](Hooks.md#the-onsend-hook)) must be one of the following types, otherwise an error will be thrown:

- `string`
- `Buffer`
- `stream`
- `undefined`
- `null`

<a name="async-await-promise"></a>
#### Async-Await and Promises
Fastify natively handles promises and supports async-await.<br>
*Note that in the following examples we are not using reply.send.*
```js
fastify.get('/promises', options, function (request, reply) {
  return new Promise(function (resolve) {
    setTimeout(resolve, 200, { hello: 'world' })
  })
})

fastify.get('/async-await', options, async function (request, reply) {
  var res = await new Promise(function (resolve) {
    setTimeout(resolve, 200, { hello: 'world' })
  })
  return res
})
```

Rejected promises default to a `500` HTTP status code. Reject the promise, or `throw` in an `async function`, with an object that has `statusCode` (or `status`) and `message` properties to modify the reply.

```js
fastify.get('/teapot', async function (request, reply) => {
  const err = new Error()
  err.statusCode = 418
  err.message = 'short and stout'
  throw err
})
```

If you want to know more please review [Routes#async-await](Routes.md#async-await).
