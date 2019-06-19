'use strict'

const {test} = require('tap')
const jsonParser = require('fast-json-body')
const request = require('../utils/request')
const http2 = require('http2')
const stream = require('stream')

const medley = require('../..')

module.exports = function bodyTests(method, config) {
  const expectsBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
  const app = medley(config)

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.route({
    method,
    path: '/',
    responseSchema: {
      200: {
        type: 'object',
        properties: {
          hello: {
            type: 'string',
          },
        },
      },
    },
    handler(req, res) {
      res.send(req.body)
    },
  })

  app.route({
    method,
    path: '/no-schema',
    handler(req, res) {
      res.send(req.body)
    },
  })

  app.route({
    method,
    path: '/with-query',
    handler(req, res) {
      req.body.hello += req.query.foo
      res.send(req.body)
    },
  })

  test(`${method} - correctly replies`, (t) => {
    t.plan(3)

    request(app, {
      method,
      url: '/',
      body: {hello: 'world'},
      json: true,
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.strictDeepEqual(res.body, {hello: 'world'})
    })
  })

  test(`${method} - correctly replies when sent a stream`, (t) => {
    t.plan(3)

    var chunk = JSON.stringify({hello: 'world'})
    const jsonStream = new stream.Readable({
      read() {
        this.push(chunk)
        chunk = null
      },
    })

    request(app, {
      method,
      url: '/',
      body: jsonStream,
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
    })
  })

  test(`${method} - correctly replies with very large body`, (t) => {
    t.plan(3)

    const largeString = 'world'.repeat(13200)
    request(app, {
      method,
      url: '/',
      body: {hello: largeString},
      json: true,
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.strictDeepEqual(res.body, {hello: largeString})
    })
  })

  test(`${method} - correctly replies if the content type has the charset`, (t) => {
    t.plan(3)

    const body = JSON.stringify({hello: 'world'})

    request(app, {
      method,
      url: '/',
      body,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.strictEqual(res.body, body)
    })
  })

  test(`${method} without schema - correctly replies`, (t) => {
    t.plan(3)

    request(app, {
      method,
      url: '/no-schema',
      body: {hello: 'world'},
      json: true,
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.strictDeepEqual(res.body, {hello: 'world'})
    })
  })

  test(`${method} with body and querystring - correctly replies`, (t) => {
    t.plan(3)

    request(app, {
      method,
      url: '/with-query?foo=hello',
      body: {hello: 'world'},
      json: true,
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.strictDeepEqual(res.body, {hello: 'worldhello'})
    })
  })

  test(`${method} with no body - HTTP/1`, (t) => {
    t.plan(3)

    request(app, {
      method,
      url: '/no-schema',
      headers: {'Content-Length': '0'},
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 200)
      t.strictEqual(res.body, '')
    })
  })

  test(`${method} with no body and no Content-Length header`, (t) => {
    t.plan(3)

    // Must use HTTP/2 to make a request without a Content-Length header
    const http2App = medley({http2: true})

    http2App.addBodyParser('application/json', (req, done) => {
      jsonParser(req.stream, done)
    })

    http2App.route({
      method,
      path: '/',
      handler(req, res) {
        res.send(req.body)
      },
    })

    http2App.listen(0, 'localhost', (err) => {
      http2App.server.unref()
      t.error(err)

      const session = http2.connect('http://localhost:' + http2App.server.address().port)

      session.request({
        ':method': method,
        ':path': '/',
      }).on('response', (headers) => {
        session.close()
        t.equal(headers[':status'], 200)
        t.equal(headers['content-length'], '0')
      }).end()
    })
  })

  if (expectsBody) {
    test(`${method} returns 415 - incorrect media type if body is not json`, (t) => {
      t.plan(2)

      request(app, {
        method,
        url: '/no-schema',
        body: 'hello world',
      }, (err, res) => {
        t.error(err)
        t.equal(res.statusCode, 415)
      })
    })
  } else {
    test(`${method} ignores body if no Content-Type header is set`, (t) => {
      t.plan(4)

      request(app, {
        method,
        url: '/no-schema',
        body: 'hello world',
      }, (err, res) => {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(res.headers['content-length'], '0')
        t.equal(res.body, '')
      })
    })
  }

  test(`${method} returns 415 - should return 415 if Content-Type is not supported`, (t) => {
    t.plan(3)

    request(app, {
      method,
      url: '/no-schema',
      body: 'hello world',
      headers: {'Content-Type': 'unknown/type'},
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 415)
      t.strictDeepEqual(JSON.parse(res.body), {
        error: 'Unsupported Media Type',
        message: 'Unsupported Media Type: "unknown/type"',
        statusCode: 415,
      })
    })
  })
}
