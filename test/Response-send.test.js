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

test('within a sub-app', (t) => {
  const app = medley()

  app.get('/', function(req, res) {
    res.status(201)
    res.set('content-type', 'text/plain')
    res.send('hello world!')
  })

  app.get('/auto', function(req, res) {
    res.send('hello world!')
  })

  app.get('/redirect', function(req, response) {
    response.redirect('/')
  })

  app.get('/redirect-code', function(req, response) {
    response.redirect(301, '/')
  })

  app.createSubApp()
    .addHook('onSend', function(request, response, payload, next) {
      response.set('x-onsend', 'yes')
      next()
    })
    .get('/redirect-onsend', function(req, response) {
      response.redirect('/')
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
        t.equal(response.statusCode, 201)
        t.equal(response.headers['content-type'], 'text/plain')
        t.equal(body.toString(), 'hello world!')
      })
    })

    t.test('auto status code and content-type ', (t) => {
      t.plan(4)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/auto',
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 200)
        t.equal(response.headers['content-type'], 'text/plain; charset=utf-8')
        t.equal(body.toString(), 'hello world!')
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
        t.strictEqual(response.statusCode, 201)
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
        t.strictEqual(response.statusCode, 201)
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

test('buffer without Content-Type should default to application/octet-stream', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.send(Buffer.alloc(1024))
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

test('buffer with Content-Type should not change the Content-Type', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.set('content-type', 'text/plain')
    res.send(Buffer.alloc(1024))
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

test('plain string without Content-Type should default to text/plain', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.send('hello world!')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'text/plain; charset=utf-8')
      t.deepEqual(body.toString(), 'hello world!')
    })
  })
})

test('plain string with Content-Type should be sent unmodified', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.type('text/css').send('hello world!')
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

test('undefined payload should be sent as-is', (t) => {
  t.plan(6)

  const app = medley()

  app.addHook('onSend', function(req, res, payload, next) {
    t.equal(payload, undefined)
    next()
  })

  app.get('/', function(req, res) {
    res.status(204).send()
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

test('null payload should be sent as-is', (t) => {
  t.plan(6)

  const app = medley()

  app.addHook('onSend', function(req, res, payload, next) {
    t.equal(payload, null)
    next()
  })

  app.get('/', function(req, res) {
    res.status(204).send(null)
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

test('res.send() can still serialize payload even if a Content-Type header is set', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.type('application/json').send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: `http://localhost:${app.server.address().port}`,
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.headers['content-type'], 'application/json')
      t.equal(body.toString(), '{"hello":"world"}')
    })
  })
})
