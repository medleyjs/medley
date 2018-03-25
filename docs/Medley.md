# medley()

The Medley module exports a factory function that is used to create a new
[**`app`**](App.md) instance. This factory function accepts an options
object which is used to customize the resulting instance. The options are:

+ [`allowUnsupportedMediaTypes`](#allowunsupportedmediatypes)
+ [`extraBodyParsingMethods`](#extrabodyparsingmethods)
+ [`http2`](#http2)
+ [`https`](#https)
+ [`maxParamLength`](#maxparamlength)
+ [`onStreamError`](#onstreamerror)
+ [`strictRouting`](#strictrouting)
+ [`trustProxy`](#trustproxy)

## Options

### `allowUnsupportedMediaTypes`

+ *boolean*

Be default, if no [body parser](BodyParser.md) matches the `Content-Type` of a request with a body,
Medley will respond with a `415 Unsupported Media Type` error. When this option is set to `true`,
requests that don't match a body parser will be allowed to continue without parsing the body.

+ Default: `false`

```js
const app = medley({allowUnsupportedMediaTypes: true});
```

### `extraBodyParsingMethods`

+ *string[]*

An array of HTTP methods (like "GET" or "DELETE") to allow request bodies to be parsed. By default,
[body parsers](BodyParser.md) are only run for `POST`, `PUT`, `PATCH`, and `OPTIONS` requests
(request bodies are ignored for all other request methods). This option can be used to specify
other methods that will have their request body parsed.

+ Default: `[]` (an empty array)

```js
const app = medley({extraBodyParsingMethods: ['DELETE']});
```

### `http2`

+ *object | boolean*

An object used to configure the HTTP server to use HTTP/2. The options are the
same as the Node.js core
[`http2.createSecureServer()`](https://nodejs.org/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler)
method (when the `key` or `cert` options are present) or the
[`http2.createServer()`](https://nodejs.org/api/http2.html#http2_http2_createserver_options_onrequesthandler)
method (when the `key` and `cert` options are not present -- this is not supported by browsers).

If `true`, the HTTP server will be created to use unencrypted HTTP/2 without
any options. Note that unencrypted HTTP/2 is not supported by browsers. See
the [HTTP/2 docs](HTTP2.md) for more information.

+ Default: `false`

The `https` option is ignored if this option is present.

### `https`

An object used to configure the server's listening socket for TLS. The options
are the same as the Node.js core
[`https.createServer()` method](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener).
When this property is not set, the socket will not be configured for TLS
(meaning it will use plain, unencrypted HTTP).

+ Default: `undefined`

### `maxParamLength`

This option sets a limit on the number of characters in the parameters of
parametric (standard, regex, and multi-parametric) routes.

+ Default: `100`

This can be useful to protect against [DoS attacks](https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS)
for routes with regex parameters.

*If the maximum length limit is reached, the not-found handler will be invoked.*

### `onStreamError`

+ *(function)*

A function that will be called with an error as the first parameter if an error occurs
while sending a stream after headers have already been sent. Normally if an error occurs,
it will be passed to the [error handler](App.md#set-error-handler), but when sending a
stream it is possible for an error to occur after headers have already been sent. In that
case, it is no longer possible to send a custom error response. This callback provides an
opportunity to do something with the error (such as log it).

+ Default: `undefined`

```js
const app = medley({
  onStreamError: function(err) {
    console.error(err)
    // NOTE: Always use a real logger instead of console.error()
  }
})
```

### `strictRouting`

Enables strict routing. When `true`, the router treats "/foo" and "/foo/" as
different. Otherwise, the router treats "/foo" and "/foo/" as the same.

+ Default: `false`

```js
const medley = require('@medley/medley')
const app = medley({ strictRouting: false })

// Registers both "/foo" and "/foo/"
app.get('/foo/', (req, res) => {
  res.send('foo')
})

// Registers both "/bar" and "/bar/"
app.get('/bar', (req, res) => {
  res.send('bar')
})

const strictApp = medley({ strictRouting: true })

strictApp.get('/foo', (req, res) => {
  res.send('foo')
})

strictApp.get('/foo/', (req, res) => {
  res.send('different foo')
})
```

### `trustProxy`

When `true`, `X-Forwarded-*` headers will be trusted and take precedence when
determining request information such as the [host](Request.md#reqhost) value.

+ Default: `false`

**Note**: `X-Forwarded-*` headers are easily spoofed and the detected values are unreliable.
