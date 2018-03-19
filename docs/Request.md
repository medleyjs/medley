# Request

Request is a core Medley object that is passed as the first argument to hooks and handlers.
It is a wrapper around Node's [`http.IncomingMessage`][http.IncomingMessage] object
(unlike in Express, which extends that object).

**Properties:**

+ [`.authority`](#reqauthority)
+ [`.body`](#reqbody)
+ [`.headers`](#reqheaders)
+ [`.host`](#reqhost)
+ [`.hostname`](#reqhostname)
+ [`.href`](#reqhref)
+ [`.method`](#reqmethod)
+ [`.origin`](#reqorigin)
+ [`.params`](#reqparams)
+ [`.path`](#reqpath)
+ [`.pathname`](#reqpathname)
+ [`.protocol`](#reqprotocol)
+ [`.query`](#reqquery)
+ [`.querystring`](#reqquerystring)
+ [`.scheme`](#reqscheme)
+ [`.stream`](#reqstream)
+ [`.url`](#requrl)

## Properties

### `req.authority`

HTTP2-style alias for [`req.host`](#reqhost).

### `req.body`

The parsed body of the request. Is `undefined` if there was no request body or if parsing the body failed.

```js
app.post('/user', (req, res) => {
  req.body // { name: 'medley', email: 'medley@example.com' }
})
```

See the [`Body Parser`](BodyParser.md) documentation for information on how to implement custom body parsers.

Note that `req.body` is set back to `undefined` when the response is sent
(after `onSend` hooks) to save memory.

### `req.headers`

The request's HTTP headers. It is an object mapping header names to values.
Header names are lower-cased.

```js
req.headers
// { 'user-agent': 'curl/7.22.0',
//   host: '127.0.0.1:8000',
//   accept: '*/*' }
```

### `req.host`

*Read-only*

The request host (`hostname:port`) if available. When the [`trustProxy`](Factory.md#trustproxy)
setting is enabled, uses the `X-Forwarded-Host` header first, then the `Host` header.

```js
req.host // 'localhost:8080'

// Another example
req.host // 'www.example.com'
```

### `req.hostname`

*Read-only*

The request host (domain) name (the [`host`](#reqhost) without the `port`).

```js
req.hostname // 'www.example.com'

// IPv6 example
req.hostname // [::1]
```

### `req.href`

*Read-only*

The full request URL.

```js
req.href // 'http://www.example.com/status/user?name=medley'
```

### `req.method`

*Read-only*

The request's HTTP method as a string.

```js
req.method // 'GET'
```

### `req.origin`

*Read-only*

The origin part of the URL (the [protocol](#reqprotocol) and [host](#reqhost)).

```js
req.origin // 'http://www.example.com'
```

### `req.params`

An object of the parameters matched in the URL.

```js
app.get('/path/:user/:foo', (req, res) => {
  // URL: /path/100/bar
  req.params // { user: '100', foo: 'bar' }
})
```

### `req.path`

Alias for [`req.url`](#requrl).

### `req.pathname`

*Read-only*

The request pathname (the [URL](#requrl) without the [query string](#reqquerystring)).

```js
// URL: /status/user?name=medley
req.pathname // '/status/user'
```

### `req.protocol`

*Read-only*

The request protocol ("http" or "https"). Supports `X-Forwarded-Proto` when
the [`trustProxy`](Factory.md#trustproxy) setting is enabled.

```js
req.protocol // 'http'
```

### `req.query`

Object parsed from the query string. If there was no query string, the object will be empty.

```js
// URL: /path?a=1&b=value
req.query // { a: '1', b: 'value' }
```

By default the query string is parsed with [`querystring.parse`](https://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options).
To use a different query string parser (such as [`qs`](https://github.com/ljharb/qs)),
add an `onRequest` hook that parses `req.querystring` like so:

```js
const qs = require('qs')

app.addHook('onRequest', (req, res, next) => {
  req.query = qs.parse(req.querystring)
  next()  
})
```

### `req.querystring`

*Read-only*

The query string found in the request's URL.

```js
// URL: /path?a=1&b=value
req.querystring // 'a=1&b=value'
```

### `req.scheme`

HTTP2-style alias for [`req.protocol`](#reqprotocol).

### `req.stream`

The [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable)
of the incoming request that can be used to read the request's body. This is the
[`http.IncomingMessage`][http.IncomingMessage] ("req") object from Node core. If the
server is using HTTP 2, this will instead be an instance of
[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#http2_class_http2_http2serverrequest).

Example of writing the request body directly to a file:

```js
const fs = require('fs')
const pump = require('pump') // https://www.npmjs.com/package/pump

// Using GET because POST request bodies should already be handled by a body parser
app.get('/', (req, res) => {
  pump(req.stream, fs.createWriteStream('./reqBody.txt'), (err) => {
    if (err) {
      res.error(err)
    } else {
      res.send('Done!')
    }
  })
})
```

This object generally should only ever be treated like a stream. Accessing
[`http.IncomingMessage`][http.IncomingMessage] properties like `.method` and
`.url` will be incompatible with future versions of Medley that will use Node's new
[HTTP 2 stream interface](https://nodejs.org/api/http2.html#http2_class_http2stream).

### `req.url`

*Read-only*

Request URL string. This contains only the URL that is present in the actual HTTP request.

If the request is:

```
GET /status/user?name=medley HTTP/1.1\r\n
Accept: text/plain\r\n
\r\n
```

Then `req.url` will be:

```js
'/status/user?name=medley'
```

[http.IncomingMessage]: https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_incomingmessage
