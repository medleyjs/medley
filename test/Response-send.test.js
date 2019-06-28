'use strict'

const {test} = require('tap')
const medley = require('..')
const request = require('./utils/request')

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

    t.throws(
      () => res.send('second'),
      new Error('Cannot call .send() when a response has already been sent')
    )
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'first')
  })
})

test('within a sub-app', (t) => {
  const app = medley()

  app.get('/', function(req, res) {
    res.status(201)
    res.setHeader('content-type', 'text/plain')
    res.send('hello world!')
  })

  app.get('/auto', function(req, res) {
    res.send('hello world!')
  })

  app.get('/redirect', function(req, res) {
    res.redirect('/')
  })

  app.get('/redirect-code', function(req, res) {
    res.redirect(301, '/')
  })

  app.createSubApp()
    .addHook('onSend', function(req, res, payload, next) {
      res.setHeader('x-onsend', 'yes')
      next()
    })
    .get('/redirect-onsend', function(req, res) {
      res.redirect('/')
    })

  t.test('status code and content-type should be correct', (t) => {
    t.plan(4)

    request(app, '/', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 201)
      t.equal(res.headers['content-type'], 'text/plain')
      t.equal(res.body, 'hello world!')
    })
  })

  t.test('auto status code and content-type ', (t) => {
    t.plan(4)

    request(app, '/auto', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      t.equal(res.body, 'hello world!')
    })
  })

  t.test('redirect to `/` - 1', (t) => {
    t.plan(2)

    request(app, '/redirect', (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 302)
    })
  })

  t.test('redirect to `/` - 2', (t) => {
    t.plan(2)

    request(app, '/redirect-code', (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 301)
    })
  })

  t.test('redirect to `/` - 3', (t) => {
    t.plan(4)

    request(app, '/redirect', {followRedirect: true}, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 201)
      t.strictEqual(res.headers['content-type'], 'text/plain')
      t.deepEqual(res.body, 'hello world!')
    })
  })

  t.test('redirect to `/` - 4', (t) => {
    t.plan(4)

    request(app, '/redirect-code', {followRedirect: true}, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 201)
      t.strictEqual(res.headers['content-type'], 'text/plain')
      t.deepEqual(res.body, 'hello world!')
    })
  })

  t.test('redirect to `/` - 5', (t) => {
    t.plan(4)

    request(app, '/redirect-onsend', (err, res) => {
      t.error(err)
      t.strictEqual(res.headers['x-onsend'], 'yes')
      t.strictEqual(res.headers['content-length'], '0')
      t.strictEqual(res.headers.location, '/')
    })
  })

  t.end()
})

test('buffer without Content-Type should default to application/octet-stream', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
    res.send(Buffer.alloc(1024))
  })

  request(app, '/', {encoding: null}, (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/octet-stream')
    t.strictDeepEqual(res.body, Buffer.alloc(1024))
  })
})

test('buffer with Content-Type should not change the Content-Type', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
    res.setHeader('content-type', 'text/plain')
    res.send(Buffer.alloc(1024))
  })

  request(app, '/', {encoding: null}, (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'text/plain')
    t.strictDeepEqual(res.body, Buffer.alloc(1024))
  })
})

test('plain string without Content-Type should default to text/plain', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
    res.send('hello world!')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.strictEqual(res.body, 'hello world!')
  })
})

test('plain string with Content-Type should be sent unmodified', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
    res.type('text/css').send('hello world!')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'text/css')
    t.strictEqual(res.body, 'hello world!')
  })
})

test('undefined payload should be sent as-is', (t) => {
  t.plan(5)

  const app = medley()

  app.addHook('onSend', function(req, res, payload, next) {
    t.equal(payload, undefined)
    next()
  })

  app.get('/', function(req, res) {
    res.status(204).send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], undefined)
    t.strictEqual(res.headers['content-length'], undefined)
    t.strictEqual(res.body.length, 0)
  })
})

test('null payload should be sent as-is', (t) => {
  t.plan(5)

  const app = medley()

  app.addHook('onSend', function(req, res, payload, next) {
    t.equal(payload, null)
    next()
  })

  app.get('/', function(req, res) {
    res.status(204).send(null)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], undefined)
    t.strictEqual(res.headers['content-length'], undefined)
    t.strictEqual(res.body.length, 0)
  })
})

test('res.send() can still serialize payload even if a Content-Type header is set', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
    res.type('application/json').send({hello: 'world'})
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.body, '{"hello":"world"}')
  })
})
