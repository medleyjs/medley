'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const http = require('http')
const NotFound = require('http-errors').NotFound
const Reply = require('../../lib/Reply')

test('Once called, Reply should return an object with methods', t => {
  t.plan(9)
  const response = {res: 'res'}

  function context() {}

  function request() {}

  const reply = new Reply(response, context, request)
  t.is(typeof reply, 'object')
  t.is(typeof reply._isError, 'boolean')
  t.is(typeof reply._customError, 'boolean')
  t.is(typeof reply.send, 'function')
  t.is(typeof reply.code, 'function')
  t.is(typeof reply.header, 'function')
  t.strictEqual(reply.res, response)
  t.strictEqual(reply.context, context)
  t.strictEqual(reply.request, request)
})

test('reply.send throw with circular JSON', t => {
  t.plan(1)
  const request = {}
  const response = {setHeader: () => {}}
  const reply = new Reply(request, response, null)
  t.throws(() => {
    var obj = {}
    obj.obj = obj
    reply.send(JSON.stringify(obj))
  })
})

test('within an instance', t => {
  const app = require('../..')()
  const test = t.test

  app.get('/', function(req, reply) {
    reply.code(200)
    reply.header('Content-Type', 'text/plain')
    reply.send('hello world!')
  })

  app.get('/auto-type', function(req, reply) {
    reply.code(200)
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

  app.register(function(instance, options, next) {
    app.addHook('onSend', function(req, reply, payload, next) {
      reply.header('x-onsend', 'yes')
      next()
    })
    app.get('/redirect-onsend', function(req, reply) {
      reply.redirect('/')
    })
    next()
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    test('status code and content-type should be correct', t => {
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

    test('auto status code shoud be 200', t => {
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

    test('auto type shoud be text/plain', t => {
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

    test('redirect to `/` - 1', t => {
      t.plan(1)

      http.get('http://localhost:' + app.server.address().port + '/redirect', function(response) {
        t.strictEqual(response.statusCode, 302)
      })
    })

    test('redirect to `/` - 2', t => {
      t.plan(1)

      http.get('http://localhost:' + app.server.address().port + '/redirect-code', function(response) {
        t.strictEqual(response.statusCode, 301)
      })
    })

    test('redirect to `/` - 3', t => {
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

    test('redirect to `/` - 4', t => {
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

    test('redirect to `/` - 5', t => {
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

test('buffer without content type should send a application/octet-stream and raw buffer', t => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.send(Buffer.alloc(1024))
  })

  app.listen(0, err => {
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

test('buffer with content type should not send application/octet-stream', t => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.header('Content-Type', 'text/plain')
    reply.send(Buffer.alloc(1024))
  })

  app.listen(0, err => {
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

test('plain string without content type should send a text/plain', t => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.send('hello world!')
  })

  app.listen(0, err => {
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

test('plain string with content type should be sent unmodified', t => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.type('text/css').send('hello world!')
  })

  app.listen(0, err => {
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

test('plain string with content type application/json should be serialized as json', t => {
  t.plan(4)

  const app = require('../..')()

  app.get('/', function(req, reply) {
    reply.type('application/json').send('hello world!')
  })

  app.listen(0, err => {
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

test('error object with a content type that is not application/json should work', t => {
  t.plan(6)

  const app = require('../..')()

  app.get('/text', function(req, reply) {
    reply.type('text/plain')
    reply.send(new Error('some application error'))
  })

  app.get('/html', function(req, reply) {
    reply.type('text/html')
    reply.send(new Error('some application error'))
  })

  app.inject({
    method: 'GET',
    url: '/text',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(JSON.parse(res.payload).message, 'some application error')
  })

  app.inject({
    method: 'GET',
    url: '/html',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(JSON.parse(res.payload).message, 'some application error')
  })
})

test('undefined payload should be sent as-is', t => {
  t.plan(6)

  const app = require('../..')()

  app.addHook('onSend', function(request, reply, payload, next) {
    t.strictEqual(payload, undefined)
    next()
  })

  app.get('/', function(req, reply) {
    reply.code(204).send()
  })

  app.listen(0, err => {
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

test('reply.send(new NotFound()) should invoke the 404 handler', t => {
  t.plan(9)

  const app = require('../..')()

  app.get('/not-found', function(req, reply) {
    reply.send(new NotFound())
  })

  app.register(function(instance, options, next) {
    instance.get('/not-found', function(req, reply) {
      reply.send(new NotFound())
    })

    instance.setNotFoundHandler(function(req, reply) {
      reply.code(404).send('Custom not found response')
    })

    next()
  }, {prefix: '/prefixed'})

  app.listen(0, err => {
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

test('reply.send(new NotFound()) should send a basic response if called inside a 404 handler', t => {
  t.plan(5)

  const app = require('../..')()

  app.get('/not-found', function(req, reply) {
    reply.send(new NotFound())
  })

  app.setNotFoundHandler(function(req, reply) {
    reply.send(new NotFound())
  })

  app.listen(0, err => {
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
