'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const http = require('http')
const NotFound = require('http-errors').NotFound
const Reply = require('../../lib/Reply')

test('Once called, Reply should return an object with methods', (t) => {
  t.plan(7)
  const res = {}
  const request = {}
  const context = {}

  const reply = new Reply(res, request, context)
  t.type(reply, Reply)
  t.equal(reply.res, res)
  t.equal(reply.request, request)
  t.equal(reply.context, context)
  t.equal(reply.sent, false)
  t.equal(reply._customError, false)
  t.equal(reply.payload, undefined)
})

test('reply.send() throws with circular JSON', (t) => {
  t.plan(1)
  const reply = new Reply({}, {}, {})
  t.throws(() => {
    var obj = {}
    obj.obj = obj
    reply.send(JSON.stringify(obj))
  })
})

test('within a sub app', (t) => {
  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.header('Content-Type', 'text/plain')
    reply.send('hello world!')
  })

  app.get('/auto-type', function(req, reply) {
    reply.type('text/plain')
    reply.send('hello world!')
  })

  app.get('/auto-status-code', function(req, reply) {
    reply.send('hello world!')
  })

  app.get('/redirect', function(req, reply) {
    reply.redirect('/')
  })

  app.get('/redirect-code', function(req, reply) {
    reply.redirect(301, '/')
  })

  app.register(function(subApp, options, next) {
    app.addHook('onSend', function(request, reply, next) {
      reply.header('x-onsend', 'yes')
      next()
    })
    app.get('/redirect-onsend', function(req, reply) {
      reply.redirect('/')
    })
    next()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    t.test('status code and content-type should be correct', (t) => {
      t.plan(4)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.strictEqual(response.headers['content-type'], 'text/plain')
        t.deepEqual(body.toString(), 'hello world!')
      })
    })

    t.test('auto status code shoud be 200', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/auto-status-code',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), 'hello world!')
      })
    })

    t.test('auto type shoud be text/plain', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/auto-type',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.headers['content-type'], 'text/plain')
        t.deepEqual(body.toString(), 'hello world!')
      })
    })

    t.test('redirect to `/` - 1', (t) => {
      t.plan(1)

      http.get('http://localhost:' + app.server.address().port + '/redirect', function(response) {
        t.strictEqual(response.statusCode, 302)
      })
    })

    t.test('redirect to `/` - 2', (t) => {
      t.plan(1)

      http.get('http://localhost:' + app.server.address().port + '/redirect-code', function(response) {
        t.strictEqual(response.statusCode, 301)
      })
    })

    t.test('redirect to `/` - 3', (t) => {
      t.plan(4)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/redirect',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.strictEqual(response.headers['content-type'], 'text/plain')
        t.deepEqual(body.toString(), 'hello world!')
      })
    })

    t.test('redirect to `/` - 4', (t) => {
      t.plan(4)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/redirect-code',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.strictEqual(response.headers['content-type'], 'text/plain')
        t.deepEqual(body.toString(), 'hello world!')
      })
    })

    t.test('redirect to `/` - 5', (t) => {
      t.plan(3)
      const url = 'http://localhost:' + app.server.address().port + '/redirect-onsend'
      http.get(url, (response) => {
        t.strictEqual(response.headers['x-onsend'], 'yes')
        t.strictEqual(response.headers['content-length'], '0')
        t.strictEqual(response.headers.location, '/')
      })
    })

    t.end()
  })
})

test('buffer without content type should send a application/octet-stream and raw buffer', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.send(Buffer.alloc(1024))
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'application/octet-stream')
      t.deepEqual(body, Buffer.alloc(1024))
    })
  })
})

test('buffer with content type should not send application/octet-stream', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.header('Content-Type', 'text/plain')
    reply.send(Buffer.alloc(1024))
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.deepEqual(body, Buffer.alloc(1024))
    })
  })
})

test('plain string without content type should send a text/plain', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.send('hello world!')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.deepEqual(body.toString(), 'hello world!')
    })
  })
})

test('plain string with content type should be sent unmodified', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.type('text/css').send('hello world!')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'text/css')
      t.deepEqual(body.toString(), 'hello world!')
    })
  })
})

test('plain string with content type application/json should be serialized as json', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.type('application/json').send('hello world!')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'application/json')
      t.deepEqual(body.toString(), '"hello world!"')
    })
  })
})

test('reply.error(err) should work with any err value', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/string', (request, reply) => {
    reply.error('string')
  })

  app.get('/undefined', (request, reply) => {
    reply.error()
  })

  app.inject('/string', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  app.inject('/undefined', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })
})

test('reply.error(err) should use err.status or err.statusCode', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/501', (request, reply) => {
    reply.error({status: 501, message: '501'})
  })

  app.get('/502', (request, reply) => {
    reply.error({status: 502, message: '502'})
  })

  app.inject('/501', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Not Implemented',
      message: '501',
      statusCode: 501,
    })
  })

  app.inject('/502', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Bad Gateway',
      message: '502',
      statusCode: 502,
    })
  })
})

test('undefined payload should be sent as-is', (t) => {
  t.plan(6)

  const app = require('../..')()

  app.addHook('onSend', function(request, reply, next) {
    t.strictEqual(reply.payload, undefined)
    next()
  })

  app.get('/', function(req, reply) {
    reply.code(204).send()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: `http://localhost:${app.server.address().port}`,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], undefined)
      t.strictEqual(response.headers['content-length'], undefined)
      t.strictEqual(body.length, 0)
    })
  })
})

test('reply.error(new NotFound()) should invoke the 404 handler', (t) => {
  t.plan(9)

  const app = require('../..')()

  app.get('/not-found', function(req, reply) {
    reply.error(new NotFound())
  })

  app.register(function(subApp, options, next) {
    subApp.get('/not-found', function(req, reply) {
      reply.error(new NotFound())
    })

    subApp.setNotFoundHandler(function(req, reply) {
      reply.code(404).send('Custom not found response')
    })

    next()
  }, {prefix: '/prefixed'})

  app.listen(0, (err) => {
    t.error(err)

    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'application/json')
      t.deepEqual(JSON.parse(body.toString()), {
        statusCode: 404,
        error: 'Not Found',
        message: 'Not found',
      })
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/prefixed/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.deepEqual(body.toString(), 'Custom not found response')
    })
  })
})

test('reply.error(new NotFound()) should send a basic response if called inside a 404 handler', (t) => {
  t.plan(5)

  const app = require('../..')()

  app.get('/not-found', function(req, reply) {
    reply.error(new NotFound())
  })

  app.setNotFoundHandler(function(req, reply) {
    reply.error(new NotFound())
  })

  app.listen(0, (err) => {
    t.error(err)

    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.deepEqual(body.toString(), '404 Not Found')
    })
  })
})

test('error with a Content-Type that is not application/json should work', (t) => {
  t.plan(8)

  const app = require('../..')()

  app.get('/text', (request, reply) => {
    reply.type('text/plain')
    reply.error(new Error('some application error'))
  })

  app.get('/html', (request, reply) => {
    reply.type('text/html')
    reply.error(new Error('some application error'))
  })

  app.inject('/text', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'some application error',
      statusCode: 500,
    })
  })

  app.inject('/html', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'some application error',
      statusCode: 500,
    })
  })
})

test('the Content-Type header should be unset before calling a not-found handler', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', (request, reply) => {
    reply.type('application/json')
    reply.error(new NotFound()) // Cause the not-found handler to be invoked
  })

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send('plain text')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'plain text')
  })
})

test('the Content-Type header should be unset before calling a custom error handler', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', (request, reply) => {
    reply.type('application/json')
    reply.error(new Error('error message')) // Cause the error handler to be invoked
  })

  app.setErrorHandler((err, request, reply) => {
    reply.code(500).send(err.message)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'error message')
  })
})
