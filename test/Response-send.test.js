'use strict'

const t = require('tap')
const test = t.test

const http = require('http')
const medley = require('..')
const sget = require('simple-get').concat

const Response = require('../lib/Response').buildResponse()

test('response.send() throws with circular JSON', (t) => {
  t.plan(1)
  const response = new Response({}, {}, {})
  t.throws(() => {
    var obj = {}
    obj.obj = obj
    response.send(JSON.stringify(obj))
  })
})

test('res.send() throws if called after response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('first')
    try {
      res.send('second')
    } catch (err) {
      t.equal(err.message, 'Cannot call .send() when a response has already been sent')
    }
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'first')
  })
})

test('within a sub app', (t) => {
  const app = medley()

  app.get('/', function(req, response) {
    response.set('content-type', 'text/plain')
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
      response.set('x-onsend', 'yes')
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

  const app = medley()

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

  const app = medley()

  app.get('/', function(req, response) {
    response.set('content-type', 'text/plain')
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

  const app = medley()

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

  const app = medley()

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

  const app = medley()

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

test('undefined payload should be sent as-is', (t) => {
  t.plan(6)

  const app = medley()

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
