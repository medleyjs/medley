'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('default error handler', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, response) {
    response.error(new Error('kaboom'))
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom error handler', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', function(req, response) {
    response.error(new Error('kaboom'))
  })

  app.setErrorHandler(function(err, request, response) {
    t.type(request, 'object')
    t.type(request, app._Request)
    response.send('an error happened: ' + err.message)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
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

test('encapsulated error handler', (t) => {
  t.plan(10)

  const app = medley()

  app.get('/', function(req, response) {
    response.error(new Error('kaboom'))
  })

  app.encapsulate('/test', function(subApp) {
    subApp.get('/', function(req, response) {
      response.error(new Error('kaboom'))
    })

    subApp.setErrorHandler(function(err, request, response) {
      t.type(request, 'object')
      t.type(request, subApp._Request)
      response.send('an error happened: ' + err.message)
    })
  })

  app.inject({
    method: 'GET',
    url: '/test',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.payload.toString(), 'an error happened: kaboom')
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom error handler with hooks', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    response.error(new Error('kaboom'))
  })

  app.setErrorHandler((err, request, response) => {
    response.send('an error happened: ' + err.message)
  })

  app.addHook('onRequest', (request, response, next) => {
    t.ok('called', 'onRequest')
    next()
  })
  app.addHook('preHandler', (request, response, next) => {
    t.ok('called', 'preHandler')
    next()
  })
  app.addHook('onSend', (request, response, payload, next) => {
    t.ok('called', 'onSend')
    next()
  })
  app.addHook('onFinished', () => {
    t.ok('called', 'onFinished')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.payload.toString(), 'an error happened: kaboom')
  })
})

test('cannot set error handler after server is listening', (t) => {
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

test('custom error handler can respond with a promise', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    response.error(new Error('kaboom'))
  })

  app.setErrorHandler((err) => {
    return Promise.resolve('Error: ' + err.message)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.strictEqual(res.payload, 'Error: kaboom')
  })
})

test('default error handler is called if a custom error handler promise rejects', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('kaboom'))
  })

  app.setErrorHandler(() => {
    return Promise.reject(new Error('Custom error handler rejection'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.payload).message, 'Custom error handler rejection')
  })
})

test('async custom error handler can still use .send()', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    response.error(new Error('kaboom'))
  })

  app.setErrorHandler((err, request, response) => {
    response.send('Error: ' + err.message)
    return Promise.resolve()
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.payload.toString(), 'Error: kaboom')
  })
})

test('the Content-Type header should be unset before calling a custom error handler', (t) => {
  t.plan(4)

  const app = medley()

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
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'error message')
  })
})
