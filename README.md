# Medley

[![npm Version](https://img.shields.io/npm/v/@medley/medley.svg)](https://www.npmjs.com/package/@medley/medley)
[![Build Status](https://travis-ci.org/medleyjs/medley.svg?branch=master)](https://travis-ci.org/medleyjs/medley)
[![Coverage Status](https://coveralls.io/repos/github/medleyjs/medley/badge.svg?branch=master)](https://coveralls.io/github/medleyjs/medley?branch=master)
[![dependencies Status](https://img.shields.io/david/medleyjs/medley.svg)](https://david-dm.org/medleyjs/medley)

Medley is a fast and modern web framework for Node.js. It fully supports both `async`/`await` and
callbacks and is compatible with Node 6 or greater. It's design incorporates concepts found in
[Express](https://github.com/expressjs/express), [Koa](https://github.com/koajs/koa),
[hapi](https://github.com/hapijs/hapi), and [Fastify](https://github.com/fastify/fastify).
Most importantly, Medley aims to provide an API that is forward-compatible with future versions
that will take full advantage of Node's [`HTTP/2` module](https://nodejs.org/api/http2.html).


## Usage

Install:

```sh
npm install @medley/medley --save
```

Create a web server:

```js
const medley = require('@medley/medley')
const app = medley()

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000)
```

### Documentation

+ [Getting Started](https://github.com/medleyjs/medley/blob/master/docs/Getting-Started.md)
+ [The `medley()` function](https://github.com/medleyjs/medley/blob/master/docs/Medley.md)
+ [The `app` Object](https://github.com/medleyjs/medley/blob/master/docs/App.md)
+ [Routing](https://github.com/medleyjs/medley/blob/master/docs/Routes.md)
+ [The `req` Object](https://github.com/medleyjs/medley/blob/master/docs/Request.md)
+ [The `res` Object](https://github.com/medleyjs/medley/blob/master/docs/Response.md)
+ [The Request Lifecyle](https://github.com/medleyjs/medley/blob/master/docs/Lifecyle.md)
+ [Hooks](https://github.com/medleyjs/medley/blob/master/docs/Hooks.md)
+ [Extensions](https://github.com/medleyjs/medley/blob/master/docs/Extensions.md)
+ [JSON Serialization](https://github.com/medleyjs/medley/blob/master/docs/Serialization.md)
+ [HTTP/2](https://github.com/medleyjs/medley/blob/master/docs/HTTP2.md)
+ [Plugins](https://github.com/medleyjs/medley/blob/master/docs/Plugins.md)


## Features

+ An API similar to [Express](https://github.com/expressjs/express)
+ Performance on par with [Fastify](https://github.com/fastify/fastify)
+ Full support for both `async`/`await` and callbacks
+ Automatic `HEAD`, `OPTIONS`, and `405` responses
+ Facilities for safely extending the framework ([extensions](https://github.com/medleyjs/medley/blob/master/docs/Extensions.md))
+ 100% test coverage
+ HTTP/2 support

### Forward-Compatibility with the `http2` Module

HTTP/2 is the future of the web. It is faster than HTTP/1.x and comes with new, speed-boosting
features such as [server push](https://www.smashingmagazine.com/2017/04/guide-http2-server-push/).
The Node.js `http2` module has a very different API from the `http`/`https` modules, but it also provides a
[compatibility API](https://nodejs.org/api/http2.html#http2_compatibility_api). Medley currently
uses the compatibility API (to support both HTTP/1.x and HTTP/2), but Medley's API is designed such
that when Medley upgrades to the full `http2` API, application code built on Medley should not need
to change. Medley's goal is to insulate application code from this transition (as much as possible)
so that code written now that won't require massive rewrites in the future.


## Ecosystem

#### Body Parsing

+ [`@medley/body-parser`](https://www.npmjs.com/package/@medley/body-parser) - Essential body parsers for Medley.
+ [`@medley/multipart`](https://www.npmjs.com/package/@medley/multipart) - Plugin for parsing `multipart/form-data` bodies.

#### Plugins

+ [`@medley/cookie`](https://www.npmjs.com/package/@medley/cookie) - Plugin for parsing and setting cookies.
+ [`@medley/etag`](https://www.npmjs.com/package/@medley/etag) - Plugin for automatic ETag generation & conditional GET responses.
+ [`@medley/self-request`](https://www.npmjs.com/package/@medley/self-request) - Plugin that augments an app to be able to make HTTP requests to itself for testing.
+ [`@medley/serve-favicon`](https://www.npmjs.com/package/@medley/serve-favicon) - Plugin for serving the default favicon.
+ [`@medley/serve-static`](https://www.npmjs.com/package/@medley/serve-static) - Plugin for serving static files.

#### Validation

+ [`ajv-request-validator`](https://www.npmjs.com/package/ajv-request-validator) - Tool for validating the `request` object of popular frameworks with Ajv.


## Acknowledgements

This project was forked from [Fastify](https://github.com/fastify/fastify). The initial commit is a clone of [`fastify/fastify@dab20bd`](https://github.com/fastify/fastify/tree/dab20bd986a74682d385228e7ead08f43eee7485). All of the credit for that work goes to the [Fastify team](https://github.com/fastify/fastify#team).
