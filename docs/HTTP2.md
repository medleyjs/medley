# HTTP/2

Medley offers **experimental support** for HTTP/2 starting from Node 8.8.0,
which includes HTTP/2 without a flag. Medley supports both encrypted and
unencrypted HTTP/2, but note that browsers only support encrypted HTTP/2.

### Secure (HTTPS)

HTTP/2 is supported in browsers **only over a secure connection**:

```js
'use strict'

const fs = require('fs')
const path = require('path')
const medley = require('@medley/medley')

const app = medley({
  http2: true,
  https: {
    key: fs.readFileSync(path.join(__dirname, 'https', 'app.key')),
    cert: fs.readFileSync(path.join(__dirname, 'https', 'app.cert'))
  }
})

app.get('/', (req, res) => {
  res.send({ hello: 'world' })
})

app.listen(3000)
```

ALPN negotiation allows to support both HTTPS and HTTP/2 over the same socket.
Node core [`req`](Request.md#reqstream) and [`res`](Response.md#resstream)
objects can be either [HTTP/1](https://nodejs.org/api/http.html) or
[HTTP/2](https://nodejs.org/api/http2.html). To configure Medley to accept both
HTTPS and secure HTTP/2 connections, use the `allowHTTP1` option:

```js
const app = medley({
  http2: true,
  https: {
    allowHTTP1: true, // Fallback support for HTTP/1
    key: fs.readFileSync(path.join(__dirname, 'https', 'app.key')),
    cert: fs.readFileSync(path.join(__dirname, 'https', 'app.cert'))
  }
})
```

### Unencrypted

If you are building microservices, you can use the unencrypted form of HTTP/2,
however this is not supported by browsers.

```js
'use strict'

const medley = require('@medley/medley')
const app = medley({
  http2: true
})

app.get('/', (req, res) => {
  res.send({ hello: 'world' })
})

app.listen(3000)
```
