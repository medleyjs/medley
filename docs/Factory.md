# Factory

The Medley module exports a factory function that is used to create new [**`Medley app`**](Server-Methods.md)
instance. This factory function accepts an options object which is used to
customize the resulting instance. This document describes the properties
available in that options object.

<a name="factory-http2"></a>
### `http2` (Status: experimental)

If `true` Node.js core's [HTTP/2](https://nodejs.org/dist/latest-v8.x/docs/api/http2.html)
HTTP/2 module is used for binding the socket.

+ Default: `false`

<a name="factory-https"></a>
### `https`

An object used to configure the server's listening socket for TLS. The options
are the same as the Node.js core
[`createServer` method](https://nodejs.org/dist/latest-v8.x/docs/api/https.html#https_https_createserver_options_requestlistener).
When this property is `null`, the socket will not be configured for TLS.

This option also applies when the [`http2`](Factory.md#factory-http2) option is set.

+ Default: `null`

<a name="factory-ignore-slash"></a>
### `ignoreTrailingSlash`

Medley uses [find-my-way](https://github.com/delvedor/find-my-way) to handle
routing. This option may be set to `true` to ignore trailing slashes in routes.
This option applies to *all* route registrations for the resulting app
instance.

+ Default: `false`

```js
const app = require('@medley/medley')({
  ignoreTrailingSlash: true
})

// registers both "/foo" and "/foo/"
app.get('/foo/', function (req, reply) {
  res.send('foo')
})

// registers both "/bar" and "/bar/"
app.get('/bar', function (req, reply) {
  res.send('bar')
})
```

<a name="factory-max-param-length"></a>
### `maxParamLength`
You can set a custom length for parameters in parametric (standard, regex and multi) routes by using `maxParamLength` option, the default value is 100 characters.<br>
This can be useful especially if you have some regex based route, protecting you against [DoS attacks](https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS).<br>
*If the maximum length limit is reached, the not found route will be invoked.*

<a name="factory-body-limit"></a>
### `bodyLimit`

Defines the maximum payload, in bytes, the server is allowed to accept.

+ Default: `1048576` (1MiB)
