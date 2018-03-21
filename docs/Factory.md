# Factory

The Medley module exports a factory function that is used to create a new
[**Medley `app`**](App.md) instance. This factory function accepts an options
object which is used to customize the resulting instance. The options are:

+ [`bodyLimit`](#bodylimit)
+ [`http2`](#http2)
+ [`https`](#https)
+ [`maxParamLength`](#maxparamlength)
+ [`strictRouting`](#strictrouting)
+ [`trustProxy`](#trustproxy)

## Options

### `bodyLimit`

Defines the maximum payload, in bytes, the server is allowed to accept.

+ Default: `1048576` (1MiB)

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

This option applies to all route declarations, including those in sub-apps.

### `trustProxy`

When `true`, `X-Forwarded-*` headers will be trusted and take precedence when
determining request information such as the [host](Request.md#reqhost) value.

+ Default: `false`

**Note**: `X-Forwarded-*` headers are easily spoofed and the detected values are unreliable.
