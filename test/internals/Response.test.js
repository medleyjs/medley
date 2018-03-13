'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const http = require('http')
const medley = require('../..')

const NotFound = require('http-errors').NotFound
const Response = require('../../lib/Response').buildResponse()

test('Response properties', (t) => {
  t.plan(4)
  const res = {}
  const request = {}
  const config = {}
  const context = {config}

  const response = new Response(res, request, context)
  t.type(response, Response)
  t.equal(response.res, res)
  t.equal(response.config, config)
  t.equal(response.sent, false)
})

test('response.status() should set the status code', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.res.statusCode, 200)

    response.status(300)
    t.equal(response.res.statusCode, 300)

    response.status(204).send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 204)
  })
})

test('response.getHeader/setHeader() get and set the response headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.getHeader('X-Custom-Header'), undefined)

    t.equal(response.setHeader('X-Custom-Header', 'custom header'), response)
    t.equal(response.getHeader('X-Custom-Header'), 'custom header')

    response.setHeader('Content-Type', 'custom/type')
    response.send('text')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'custom header')
    t.equal(res.headers['content-type'], 'custom/type')
    t.equal(res.payload, 'text')
  })
})

test('response.appendHeader() adds to existing headers', (t) => {
  t.plan(13)

  const app = medley()

  app.get('/', (request, response) => {
    response.appendHeader('X-Custom-Header', 'first')
    t.equal(response.getHeader('X-Custom-Header'), 'first')

    t.equal(response.appendHeader('X-Custom-Header', 'second'), response)
    t.deepEqual(response.getHeader('X-Custom-Header'), ['first', 'second'])

    t.equal(response.appendHeader('X-Custom-Header', ['3', '4']), response)
    t.deepEqual(response.getHeader('X-Custom-Header'), ['first', 'second', '3', '4'])

    response.send()
  })

  app.get('/append-multiple-to-string', (request, response) => {
    response.appendHeader('X-Custom-Header', 'first')
    t.equal(response.getHeader('X-Custom-Header'), 'first')

    response.appendHeader('X-Custom-Header', ['second', 'third'])
    t.deepEqual(response.getHeader('X-Custom-Header'), ['first', 'second', 'third'])

    response.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(res.headers['x-custom-header'], ['first', 'second', '3', '4'])
  })

  app.inject('/append-multiple-to-string', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(res.headers['x-custom-header'], ['first', 'second', 'third'])
  })
})

test('response.removeHeader() removes response headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    response.setHeader('X-Custom-Header', 'custom header')
    t.equal(response.getHeader('X-Custom-Header'), 'custom header')

    t.equal(response.removeHeader('X-Custom-Header'), response)
    t.equal(response.getHeader('X-Custom-Header'), undefined)

    response
      .setHeader('X-Custom-Header-2', ['a', 'b'])
      .removeHeader('X-Custom-Header-2')

    t.equal(response.getHeader('X-Custom-Header-2'), undefined)

    response.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.notOk('x-custom-header' in res.headers)
    t.notOk('x-custom-header-2' in res.headers)
  })
})

test('response.send() throws with circular JSON', (t) => {
  t.plan(1)
  const response = new Response({}, {}, {})
  t.throws(() => {
    var obj = {}
    obj.obj = obj
    response.send(JSON.stringify(obj))
  })
})

test('response.send() throws if called after response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (request, response) => {
    response.send('first')
    try {
      response.send('second')
    } catch (err) {
      t.equal(err.message, 'Cannot call response.send() when a response has already been sent')
    }
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'first')
  })
})

test('response.error() throws if called after response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (request, response) => {
    response.send('send')
    try {
      response.error(new Error())
    } catch (err) {
      t.equal(err.message, 'Cannot call response.error() when a response has already been sent')
    }
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'send')
  })
})

test('within a sub app', (t) => {
  const app = require('../..')()

  app.get('/', function(req, response) {
    response.setHeader('Content-Type', 'text/plain')
    response.send('hello world!')
  })

  app.get('/auto-type', function(req, response) {
    response.type('text/plain')
    response.send('hello world!')
  })

  app.get('/auto-status-code', function(req, response) {
    response.send('hello world!')
  })

  app.get('/redirect', function(req, response) {
    response.redirect('/')
  })

  app.get('/redirect-code', function(req, response) {
    response.redirect(301, '/')
  })

  app.register(function(subApp, options, next) {
    app.addHook('onSend', function(request, response, payload, next) {
      response.setHeader('x-onsend', 'yes')
      next()
    })
    app.get('/redirect-onsend', function(req, response) {
      response.redirect('/')
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

  app.get('/', function(req, response) {
    response.send(Buffer.alloc(1024))
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

  app.get('/', function(req, response) {
    response.setHeader('Content-Type', 'text/plain')
    response.send(Buffer.alloc(1024))
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

  app.get('/', function(req, response) {
    response.send('hello world!')
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

  app.get('/', function(req, response) {
    response.type('text/css').send('hello world!')
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

  app.get('/', function(req, response) {
    response.type('application/json').send('hello world!')
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

test('response.error(err) should work with any err value', (t) => {
  t.plan(8)

  const app = require('../..')()

  app.get('/string', (request, response) => {
    response.error('string')
  })

  app.get('/undefined', (request, response) => {
    response.error()
  })

  app.get('/array', (request, response) => {
    response.error([1, 2])
  })

  app.get('/object', (request, response) => {
    response.error({message: 'object message'})
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

  app.inject('/array', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  app.inject('/object', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'object message',
      statusCode: 500,
    })
  })
})

test('response.error(err) should use err.status or err.statusCode', (t) => {
  t.plan(4)

  const app = require('../..')()

  app.get('/501', (request, response) => {
    response.error({status: 501, message: '501'})
  })

  app.get('/502', (request, response) => {
    response.error({status: 502, message: '502'})
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

  app.addHook('onSend', function(request, response, payload, next) {
    t.strictEqual(response.payload, undefined)
    next()
  })

  app.get('/', function(req, response) {
    response.status(204).send()
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

test('response.error(new NotFound()) should invoke the 404 handler', (t) => {
  t.plan(9)

  const app = require('../..')()

  app.get('/not-found', function(req, response) {
    response.error(new NotFound())
  })

  app.register(function(subApp, options, next) {
    subApp.get('/not-found', function(req, response) {
      response.error(new NotFound())
    })

    subApp.setNotFoundHandler(function(req, response) {
      response.status(404).send('Custom not found response')
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
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.strictEqual(body.toString(), 'Not Found: GET /not-found')
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/prefixed/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.strictEqual(body.toString(), 'Custom not found response')
    })
  })
})

test('response.error(new NotFound()) should send a basic response if called inside a 404 handler', (t) => {
  t.plan(5)

  const app = require('../..')()

  app.get('/not-found', function(req, response) {
    response.error(new NotFound())
  })

  app.setNotFoundHandler(function(req, response) {
    response.error(new NotFound())
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
      t.deepEqual(body.toString(), 'Not Found: GET /not-found')
    })
  })
})

test('error with a Content-Type that is not application/json should work', (t) => {
  t.plan(8)

  const app = require('../..')()

  app.get('/text', (request, response) => {
    response.type('text/plain')
    response.error(new Error('some application error'))
  })

  app.get('/html', (request, response) => {
    response.type('text/html')
    response.error(new Error('some application error'))
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

  app.get('/', (request, response) => {
    response.type('application/json')
    response.error(new NotFound()) // Cause the not-found handler to be invoked
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('plain text')
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

  app.get('/', (request, response) => {
    response.type('application/json')
    response.error(new Error('error message')) // Cause the error handler to be invoked
  })

  app.setErrorHandler((err, request, response) => {
    response.status(500).send(err.message)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'error message')
  })
})
