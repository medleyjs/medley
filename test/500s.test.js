'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('default 500', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.error(new Error('kaboom'))
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom 500', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.error(new Error('kaboom'))
  })

  app.setErrorHandler(function(err, request, reply) {
    t.type(request, 'object')
    t.type(request, app._Request)
    reply
      .code(500)
      .type('text/plain')
      .send('an error happened: ' + err.message)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain')
    t.deepEqual(res.payload.toString(), 'an error happened: kaboom')
  })
})

test('.setErrorHandler() should throw if not passed a function', (t) => {
  const app = medley()

  try {
    app.setErrorHandler(null)
    t.fail()
  } catch (err) {
    t.equal(err.message, "Error handler must be a function. Got value with type 'object': null")
  }

  try {
    app.setErrorHandler(true)
    t.fail()
  } catch (err) {
    t.equal(err.message, "Error handler must be a function. Got value with type 'boolean': true")
  }

  try {
    app.setErrorHandler({})
    t.fail()
  } catch (err) {
    t.equal(err.message, "Error handler must be a function. Got value with type 'object': [object Object]")
  }

  t.end()
})

test('encapsulated 500', (t) => {
  t.plan(10)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.error(new Error('kaboom'))
  })

  app.register(function(f, opts, next) {
    f.get('/', function(req, reply) {
      reply.error(new Error('kaboom'))
    })

    f.setErrorHandler(function(err, request, reply) {
      t.type(request, 'object')
      t.type(request, f._Request)
      reply
        .code(500)
        .type('text/plain')
        .send('an error happened: ' + err.message)
    })

    next()
  }, {prefix: 'test'})

  app.inject({
    method: 'GET',
    url: '/test',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain')
    t.deepEqual(res.payload.toString(), 'an error happened: kaboom')
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom 500 with hooks', (t) => {
  t.plan(7)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new Error('kaboom'))
  })

  app.setErrorHandler((err, request, reply) => {
    reply
      .code(500)
      .type('text/plain')
      .send('an error happened: ' + err.message)
  })

  app.addHook('onSend', (request, reply, next) => {
    t.ok('called', 'onSend')
    next()
  })
  app.addHook('onRequest', (request, res, next) => {
    t.ok('called', 'onRequest')
    next()
  })
  app.addHook('onResponse', () => {
    t.ok('called', 'onResponse')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain')
    t.deepEqual(res.payload.toString(), 'an error happened: kaboom')
  })
})

test('cannot set errorHandler after binding', (t) => {
  t.plan(2)

  const app = medley()
  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    try {
      app.setErrorHandler(() => { })
      t.fail()
    } catch (e) {
      t.pass()
    }
  })
})
