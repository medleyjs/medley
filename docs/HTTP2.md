# HTTP/2

Medley supports both encrypted and unencrypted HTTP/2, but note that browsers
only support encrypted HTTP/2.

### Secure (HTTPS)

HTTP/2 is supported in browsers **only over a secure connection**:

```js
const fs = require('fs');
const path = require('path');
const medley = require('@medley/medley');

const app = medley({
  http2: {
    key: fs.readFileSync(path.join(__dirname, 'https', 'app.key')),
    cert: fs.readFileSync(path.join(__dirname, 'https', 'app.cert'))
  }
});

app.get('/', (req, res) => {
  res.send({ hello: 'world' });
});

app.listen(3000);
```

ALPN negotiation allows to support both HTTPS and HTTP/2 over the same socket.
To configure Medley to accept both HTTPS and secure HTTP/2 connections, the
`allowHTTP1` option can be used:

```js
const app = medley({
  http2: {
    allowHTTP1: true, // Fallback support for HTTP/1
    key: fs.readFileSync(path.join(__dirname, 'https', 'app.key')),
    cert: fs.readFileSync(path.join(__dirname, 'https', 'app.cert'))
  }
});
```

### Unencrypted

It is also possible to configure a server to use unencrypted HTTP/2,
however this is not supported by browsers.

```js
const medley = require('@medley/medley');
const app = medley({
  http2: true
});

app.get('/', (req, res) => {
  res.send({ hello: 'world' });
});

app.listen(3000);
```
