'use strict'

const t = require('tap')
const test = t.test
const jsonParser = require('fast-json-body')
const sget = require('simple-get').concat
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

  app.listen(0, function(err) {
    if (err) {
      t.error(err)
    }

    app.server.unref()

    test(`${method} - correctly replies`, (t) => {
      t.plan(3)
      sget({
        method,
        url: 'http://localhost:' + app.server.address().port,
        body: {
          hello: 'world',
        },
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, {hello: 'world'})
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

      sget({
        method,
        url: 'http://localhost:' + app.server.address().port,
        body: jsonStream,
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
        },
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 200)
        t.deepEqual(JSON.parse(body.toString()), {hello: 'world'})
      })
    })

    test(`${method} - correctly replies with very large body`, (t) => {
      t.plan(3)

      const largeString = 'world'.repeat(13200)
      sget({
        method,
        url: 'http://localhost:' + app.server.address().port,
        body: {hello: largeString},
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, {hello: largeString})
      })
    })

    test(`${method} - correctly replies if the content type has the charset`, (t) => {
      t.plan(3)
      sget({
        method,
        url: 'http://localhost:' + app.server.address().port,
        body: JSON.stringify({hello: 'world'}),
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })

    test(`${method} without schema - correctly replies`, (t) => {
      t.plan(3)
      sget({
        method,
        url: 'http://localhost:' + app.server.address().port + '/no-schema',
        body: {
          hello: 'world',
        },
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, {hello: 'world'})
      })
    })

    test(`${method} with body and querystring - correctly replies`, (t) => {
      t.plan(3)
      sget({
        method,
        url: 'http://localhost:' + app.server.address().port + '/with-query?foo=hello',
        body: {
          hello: 'world',
        },
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, {hello: 'worldhello'})
      })
    })

    test(`${method} with no body - correctly replies`, (t) => {
      t.plan(6)

      sget({
        method,
        url: 'http://localhost:' + app.server.address().port + '/no-schema',
        headers: {'Content-Length': '0'},
        timeout: 500,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.strictEqual(body.toString(), '')
      })

      // Must use inject to make a request without a Content-Length header
      app.inject({
        method,
        url: '/no-schema',
      }, (err, res) => {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.strictEqual(res.payload, '')
      })
    })

    if (expectsBody) {
      test(`${method} returns 415 - incorrect media type if body is not json`, (t) => {
        t.plan(2)
        sget({
          method,
          url: 'http://localhost:' + app.server.address().port + '/no-schema',
          body: 'hello world',
          timeout: 500,
        }, (err, response) => {
          t.error(err)
          t.equal(response.statusCode, 415)
        })
      })
    } else {
      test(`${method} ignores body if no Content-Type header is set`, (t) => {
        t.plan(4)
        sget({
          method,
          url: 'http://localhost:' + app.server.address().port + '/no-schema',
          body: 'hello world',
          timeout: 500,
        }, (err, response, body) => {
          t.error(err)
          t.equal(response.statusCode, 200)
          t.equal(response.headers['content-length'], '0')
          t.equal(body.toString(), '')
        })
      })
    }

    test(`${method} returns 415 - should return 415 if Content-Type is not supported`, (t) => {
      t.plan(3)
      sget({
        method,
        url: 'http://localhost:' + app.server.address().port + '/no-schema',
        body: 'hello world',
        headers: {'Content-Type': 'unknown/type'},
        timeout: 500,
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 415)
        t.deepEqual(JSON.parse(body.toString()), {
          error: 'Unsupported Media Type',
          message: 'Unsupported Media Type: "unknown/type"',
          statusCode: 415,
        })
      })
    })

    test(`${method} returns 400 - Bad Request with invalid Content-Length header`, (t) => {
      t.plan(3)

      app.inject({
        method,
        url: '/',
        payload: '{}',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': 'not a number',
        },
      }, (err, res) => {
        t.error(err)
        t.equal(res.statusCode, 400)
        t.equal(JSON.parse(res.payload).message, 'Invalid Content-Length: "not a number"')
      })
    })
  })
}
