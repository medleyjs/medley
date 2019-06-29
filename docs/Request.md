# Request

Request is a core Medley object that is passed as the first argument to hooks and handlers.
It is a wrapper around Node's [`http.IncomingMessage`][http.IncomingMessage] object
(unlike in Express, which extends that object).

This documentation refers to Request instances as `req`, although the object could be named
anything (e.g. `request`) since it is almost always received as a function parameter.

```js
app.get('/user/:id', function(req, res) {
  res.send('User ' + req.params.id);
});
```

**Properties:**

+ [`.body`](#reqbody)
+ [`.headers`](#reqheaders)
+ [`.host`](#reqhost) (_alias:_ `.authority`)
+ [`.hostname`](#reqhostname)
+ [`.href`](#reqhref)
+ [`.method`](#reqmethod)
+ [`.origin`](#reqorigin)
+ [`.params`](#reqparams)
+ [`.path`](#reqpath)
+ [`.protocol`](#reqprotocol) (_alias:_ `.scheme`)
+ [`.query`](#reqquery)
+ [`.querystring`](#reqquerystring)
+ [`.scheme`](#reqscheme)
+ [`.search`](#reqsearch)
+ [`.stream`](#reqstream)
+ [`.url`](#requrl)

## Properties

### `req.body`

Defaults to `undefined`. Is set to the parsed request body if a
[body-parser](https://github.com/medleyjs/medley#body-parsing) was run.

```js
const bodyParser = require('@medley/body-parser');

app.get('/users', (req, res) => {
  req.body // undefined
});

app.post('/users', [bodyParser.json()], (req, res) => {
  req.body // { name: 'medley', email: 'medley@example.com' }
});
```

**Note:** `req.body` is set back to `undefined` when the response is sent
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

*Read-only*<br>
Alias: `req.authority` (from the HTTP/2 `:authority` header)

The request host (`hostname:port`) if available. When the [`trustProxy`](Medley.md#trustproxy)
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
req.hostname // '[::1]'
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
app.get('/user/:id/:name', (req, res) => {
  // URL: /user/100/Monika
  req.params // { id: '100', name: 'Monika' }
});

app.get('/assets/*', (req, res) => {
  // URL: /assets/js/main.js
  req.params // { '*': 'js/main.js' }
});
```

### `req.path`

*Read-only*

The [pathname](https://nodejs.org/dist/latest/docs/api/url.html#url_url_pathname)
part of the request URL.

```js
// URL: /status/user?name=medley
req.path // '/status/user'
```

### `req.protocol`

*Read-only*<br>
Alias: `req.scheme` (from the HTTP/2 `:scheme` header)

The request protocol (e.g. "http" or "https"). Supports reading the `X-Forwarded-Proto`
header when the [`trustProxy`](Medley.md#trustproxy) setting is enabled.

```js
req.protocol // 'https'
```

### `req.query`

Object parsed from the query string. If there was no query string, the object will be empty.

```js
// URL: /path?a=1&b=value
req.query // { a: '1', b: 'value' }
```

By default, the query string is parsed with [`querystring.parse`](https://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options).
To use a different query string parser, set the [`queryParser`](Medley.md#queryparser) option.

### `req.querystring`

*Read-only*

The query string found in the request's URL (without the `?`).

```js
// URL: /path?a=1&b=value
req.querystring // 'a=1&b=value'

// URL: /path/no-query
req.querystring // ''
```

### `req.search`

*Read-only*

The search string found in the request's URL (query string with the `?`).

```js
// URL: /path?a=1&b=value
req.search // '?a=1&b=value'

// URL: /path/no-query
req.search // ''
```

### `req.stream`

The [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable)
of the incoming request that can be used to read the request's body. This is the
[`http.IncomingMessage`][http.IncomingMessage] ("req") object from Node core. If the
server is using HTTP/2, this will instead be an instance of
[`http2.Http2ServerRequest`](https://nodejs.org/api/http2.html#http2_class_http2_http2serverrequest).

Example of writing the request body directly to a file:

```js
const fs = require('fs');
const {pipeline} = require('stream');

app.post('/', (req, res) => {
  pipeline(req.stream, fs.createWriteStream('./reqBody.txt'), (err) => {
    if (err) {
      res.error(err);
    } else {
      res.send('Done!');
    }
  });
});
```

This object generally should only ever be treated like a stream. Accessing
[`http.IncomingMessage`][http.IncomingMessage] properties like `.method` and
`.url` will be incompatible with future versions of Medley that will use Node's new
[HTTP/2 stream interface](https://nodejs.org/api/http2.html#http2_class_http2stream).

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
