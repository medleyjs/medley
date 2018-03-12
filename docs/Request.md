# Request

Request is a core Medley object that is passed as the first argument to hooks and handlers.
It is a wrapper around Node's [`http.IncomingMessage`][http.IncomingMessage] object.

**Properties:**

+ [`.body`](#requestbody)
+ [`.headers`](#requestheaders)
+ [`.method`](#requestmethod)
+ [`.params`](#requestparams)
+ [`.query`](#requestquery)
+ [`.querystring`](#requestquerystring)
+ [`.req`](#requestreq)
+ [`.url`](#requesturl)

## Properties

### `request.body`

The parsed body of the request. Is `undefined` if there was no request body or if parsing the body failed.

```js
app.post('/user', (request, response) => {
  request.body // { name: 'medley', email: 'medley@example.com' }
})
```

See the [`Body Parser`](BodyParser.md) documentation for information on how to implement custom body parsers.

Note that `request.body` is set back to `undefined` when the response is sent
(after `onSend` hooks) to save memory.

### `request.headers`

The request's HTTP headers. It is an object mapping header names to values. Header names are lower-cased.

```js
request.headers
// { 'user-agent': 'curl/7.22.0',
//   host: '127.0.0.1:8000',
//   accept: '*/*' }
```

### `request.method`

*Read-only*

The request's HTTP method as a string.

```js
request.method // 'GET'
```

### `request.params`

An object of the parameters matched in the URL.

```js
app.get('/path/:user/:foo', (request, response) => {
  // URL: /path/100/bar
  request.params // { user: '100', foo: 'bar' }
})
```

### `request.query`

Object parsed from the query string. If there was no query string, the object will be empty.

```js
// URL: /path?a=1&b=value
request.query // { a: '1', b: 'value' }
```

By default the query string is parsed with [`querystring.parse`](https://nodejs.org/dist/latest/docs/api/querystring.html#querystring_querystring_parse_str_sep_eq_options).
To use a different query string parser (such as [`qs`](https://github.com/ljharb/qs)),
add an `onRequest` hook that parses `request.querystring` like so:

```js
const qs = require('qs')

app.addHook('onRequest', (request, response, next) => {
  request.query = qs.parse(request.querystring)
  next()  
})
```

### `request.querystring`

*Read-only*

The query string found in the request's URL.

```js
// URL: /path?a=1&b=value
request.querystring // 'a=1&b=value'
```

### `request.req`

The native [`http.IncomingMessage`][http.IncomingMessage] object from Node core.

### `request.url`

*Read-only*

Request URL string. This contains only the URL that is present in the actual HTTP request.

If the request is:

```
GET /status/user?name=medley HTTP/1.1\r\n
Accept: text/plain\r\n
\r\n
```

Then `request.url` will be:

```js
'/status/user?name=medley'
```

[http.IncomingMessage]: https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_incomingmessage
