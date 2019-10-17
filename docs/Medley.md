# medley()

The Medley module exports a factory function that is used to create a new
[**`app`**](App.md) instance. This factory function accepts an options
object which is used to customize the resulting instance. The options are:

+ [`http2`](#http2)
+ [`https`](#https)
+ [`methodNotAllowedHandler`](#methodnotallowedhandler)
+ [`notFoundHandler`](#notfoundhandler)
+ [`onErrorSending`](#onerrorsending)
+ [`queryParser`](#queryparser)
+ [`server`](#server)
+ [`trustProxy`](#trustproxy)

## Options

### `http2`

Type: `object` | `boolean`<br>
Default: `false`

An object used to configure the HTTP server to use HTTP/2. The options are the
same as the Node.js core
[`http2.createSecureServer()`](https://nodejs.org/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler)
method (when the `key` or `cert` options are present) or the
[`http2.createServer()`](https://nodejs.org/api/http2.html#http2_http2_createserver_options_onrequesthandler)
method (when the `key` and `cert` options are not present -- this is not supported by browsers).

If `true`, the HTTP server will be created to use unencrypted HTTP/2 without
any options. Note that unencrypted HTTP/2 is not supported by browsers.

See the [HTTP/2 docs](HTTP2.md) for more information and examples.

The `https` option is ignored if this option is present.

### `https`

Type: `object`

An object used to configure the server's listening socket for TLS. The options
are the same as the Node.js core
[`https.createServer()` method](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).

```js
const app = medley({
  https: {
    key: fs.readFileSync(path.join(__dirname, 'tls', 'app.key')),
    cert: fs.readFileSync(path.join(__dirname, 'tls', 'app.cert'))
  }
});
```

### `methodNotAllowedHandler`

Type: `function(req, res)` (`req` - [Request](Request.md), `res` - [Response](Response.md))

A handler function that is called when the request URL matches a route but
there is no handler for the request method.

```js
const medley = require('@medley/medley');
const app = medley({
  methodNotAllowedHandler: (req, res) => {
    res.status(405).send('Method Not Allowed: ' + req.method);
  }
});
```

[`405 Method Not Allowed`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405)
responses require the [`Allow`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Allow)
header to be set. To make this convenient, the [`res.config`](Response.md#resconfig)
object in the handler will contain an `allowedMethods` property, which will be an
array of the HTTP methods that have handlers for the route.

```js
const medley = require('@medley/medley');
const app = medley({
  methodNotAllowedHandler: (req, res) => {
    res.config.allowedMethods; // ['GET', 'HEAD', 'POST']
    res.setHeader('allow', res.config.allowedMethods.join());
    res.status(405).send('Method Not Allowed: ' + req.method);
  }
});

app.get('/users', (req, res) => { /* ... */ });
app.post('/users', (req, res) => { /* ... */ });
```

While this handler is intended to be used to send a [`405 Method Not Allowed`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405)
response, it could be used to send a `404 Not Found` response instead.

```js
const medley = require('@medley/medley');

function notFoundHandler(req, res) {
  res.status(404).send('Not Found: ' + req.url);
}

const app = medley({
  notFoundHandler,
  methodNotAllowedHandler: notFoundHandler,
});
```

[Hooks](Hooks.md) that are added to the root `app` will run before/after the `methodNotAllowedHandler`.

### `notFoundHandler`

Type: `function(req, res)` (`req` - [Request](Request.md), `res` - [Response](Response.md))

A handler function that is called when no routes match the request URL.

```js
const medley = require('@medley/medley');
const app = medley({
  notFoundHandler: (req, res) => {
    res.status(404).send('Not Found: ' + req.url);
  }
});
```

[Hooks](Hooks.md) that are added to the root `app` will run before/after the `notFoundHandler`.

### `onErrorSending`

Type: `function(err)`

A function that will be called with an error as the first parameter if an error occurs
while trying to send a response. Errors that occur while sending a response can’t be
sent to the [`onError` hooks](Hooks.md#onError-hook) (since these errors can occur
after the `onError` hooks have already run), so the best that can be done is to
log the error.

```js
const logger = require('some-logger'); // Just an example
const app = medley({
  onErrorSending: (err) => {
    logger.error(err);
    // Always use a real logger rather than console.error()
  }
});
```

Specifically, this function will be called when:

+ Sending a stream errors
+ An [`onSend` hook](Hooks.md#onSend-hook) errors

### `queryParser`

Default: [`querystring.parse`](https://nodejs.org/dist/latest/docs/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)

A custom function to parse the URL's query string into the value for
[`req.query`](Request.md#reqquery). It will receive the complete query
string and should return an object of query keys and their values.

```js
const medley = require('@medley/medley');
const qs = require('qs'); // https://github.com/ljharb/qs

const app = medley({ queryParser: qs.parse });
```

### `server`

A custom [HTTP](https://nodejs.org/api/http.html#http_class_http_server),
[HTTPS](https://nodejs.org/api/https.html#https_class_https_server), or
[HTTP/2](https://nodejs.org/api/http2.html#http2_class_http2secureserver)
server instance.

```js
const medley = require('@medley/medley');
const http = require('http');

const server = http.createServer()

const app = medley({ server });
```

### `trustProxy`

Default: `false`

When `true`, `X-Forwarded-*` headers will be trusted and take precedence when
determining request information such as the [host](Request.md#reqhost) value.

**Note**: `X-Forwarded-*` headers are easily spoofed and the detected values are unreliable.
