'use strict'

const sget = require('simple-get').concat
const stream = require('stream')

const app = require('../..')()

module.exports.payloadMethod = function(method, t) {
  const test = t.test
  const upMethod = method.toUpperCase()
  const loMethod = method.toLowerCase()

  app[loMethod]('/', {
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
  }, function(request, response) {
    response.send(request.body)
  })

  app[loMethod]('/no-schema', function(request, response) {
    response.send(request.body)
  })

  app[loMethod]('/with-query', function(request, response) {
    request.body.hello += request.query.foo
    response.send(request.body)
  })

  app[loMethod]('/with-limit', {bodyLimit: 1}, function(request, response) {
    response.send(request.body)
  })

  app.listen(0, function(err) {
    if (err) {
      t.error(err)
    }

    app.server.unref()

    test(`${upMethod} - correctly replies`, (t) => {
      t.plan(3)
      sget({
        method: upMethod,
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

    // Node errors for non-P* requests with a stream body
    if (upMethod !== 'OPTIONS' && upMethod !== 'DELETE') {
      test(`${upMethod} - correctly replies when sent a stream`, (t) => {
        t.plan(3)

        var chunk = JSON.stringify({hello: 'world'})
        const jsonStream = new stream.Readable({
          read() {
            this.push(chunk)
            chunk = null
          },
        })

        sget({
          method: upMethod,
          url: 'http://localhost:' + app.server.address().port,
          body: jsonStream,
          headers: {'Content-Type': 'application/json'},
        }, (err, response, body) => {
          t.error(err)
          t.equal(response.statusCode, 200)
          t.deepEqual(JSON.parse(body.toString()), {hello: 'world'})
        })
      })
    }

    test(`${upMethod} - correctly replies with very large body`, (t) => {
      t.plan(3)

      const largeString = 'world'.repeat(13200)
      sget({
        method: upMethod,
        url: 'http://localhost:' + app.server.address().port,
        body: {hello: largeString},
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, {hello: largeString})
      })
    })

    test(`${upMethod} - correctly replies if the content type has the charset`, (t) => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + app.server.address().port,
        body: JSON.stringify({hello: 'world'}),
        headers: {
          'content-type': 'application/json;charset=utf-8',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })

    test(`${upMethod} without schema - correctly replies`, (t) => {
      t.plan(3)
      sget({
        method: upMethod,
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

    test(`${upMethod} with body and querystring - correctly replies`, (t) => {
      t.plan(3)
      sget({
        method: upMethod,
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

    test(`${upMethod} with no body - correctly replies`, (t) => {
      t.plan(6)

      sget({
        method: upMethod,
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
        method: upMethod,
        url: '/no-schema',
      }, (err, res) => {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.strictEqual(res.payload, '')
      })
    })

    if (upMethod === 'POST' || upMethod === 'PUT' || upMethod === 'PATCH') {
      test(`${upMethod} returns 415 - incorrect media type if body is not json`, (t) => {
        t.plan(2)
        sget({
          method: upMethod,
          url: 'http://localhost:' + app.server.address().port + '/no-schema',
          body: 'hello world',
          timeout: 500,
        }, (err, response) => {
          t.error(err)
          t.equal(response.statusCode, 415)
        })
      })
    } else { // OPTION, DELETE
      test(`${upMethod} ignores body if no Content-Type header is set`, (t) => {
        t.plan(3)
        sget({
          method: upMethod,
          url: 'http://localhost:' + app.server.address().port + '/no-schema',
          body: 'hello world',
          timeout: 500,
        }, (err, response) => {
          t.error(err)
          t.equal(response.statusCode, 200)
          t.equal(response.headers['content-length'], '0')
        })
      })
    }

    test(`${upMethod} returns 415 - should return 415 if Content-Type is not supported`, (t) => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + app.server.address().port + '/no-schema',
        body: 'hello world',
        headers: {'Content-Type': 'unknown/type'},
        timeout: 500,
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 415)
        t.deepEqual(JSON.parse(body.toString()), {
          error: 'Unsupported Media Type',
          message: 'Unsupported Media Type: unknown/type',
          statusCode: 415,
        })
      })
    })

    test(`${upMethod} returns 400 - Bad Request with malformed JSON`, (t) => {
      t.plan(6)

      sget({
        method: upMethod,
        url: 'http://localhost:' + app.server.address().port,
        body: 'hello world',
        headers: {'Content-Type': 'application/json'},
        timeout: 500,
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 400)
        t.equal(JSON.parse(body.toString()).message, 'Unexpected token h in JSON at position 0')
      })

      sget({
        method: upMethod,
        url: 'http://localhost:' + app.server.address().port,
        body: '',
        headers: {'Content-Type': 'application/json'},
        timeout: 500,
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 400)
        t.equal(JSON.parse(body.toString()).message, 'Unexpected end of JSON input')
      })
    })

    test(`${upMethod} returns 400 - Bad Request with invalid Content-Length header`, (t) => {
      t.plan(3)

      app.inject({
        method: upMethod,
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

    test(`${upMethod} returns 413 - Payload Too Large`, (t) => {
      t.plan(upMethod === 'OPTIONS' || upMethod === 'DELETE' ? 4 : 6)

      sget({
        method: upMethod,
        url: 'http://localhost:' + app.server.address().port,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': 1024 * 1024 + 1,
        },
      }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 413)
      })

      // Node errors for non-P* requests with a stream body
      if (upMethod !== 'OPTIONS' && upMethod !== 'DELETE') {
        var chunk = Buffer.allocUnsafe(1024 * 1024 + 1)
        const largeStream = new stream.Readable({
          read() {
            this.push(chunk)
            chunk = null
          },
        })
        sget({
          method: upMethod,
          url: 'http://localhost:' + app.server.address().port,
          headers: {'Content-Type': 'application/json'},
          body: largeStream,
          timeout: 500,
        }, (err, response) => {
          t.error(err)
          t.strictEqual(response.statusCode, 413)
        })
      }

      sget({
        method: upMethod,
        url: `http://localhost:${app.server.address().port}/with-limit`,
        headers: {'Content-Type': 'application/json'},
        body: {},
        json: true,
      }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 413)
      })
    })
  })
}
