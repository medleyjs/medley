'use strict'

const {test} = require('tap')
const medley = require('..')
const request = require('./utils/request')

test('default error handler', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.error(new Error('kaboom'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom error handler', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', function(req, res) {
    res.error(new Error('kaboom'))
  })

  app.setErrorHandler(function(err, req, res) {
    t.type(req, 'object')
    t.type(req, app._Request)
    res.send('an error happened: ' + err.message)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'an error happened: kaboom')
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
  t.plan(9)

  const app = medley()

  app.get('/', function(req, response) {
    response.error(new Error('kaboom'))
  })

  app.createSubApp('/test')
    .get('/', function(req, res) {
      res.error(new Error('kaboom'))
    })
    .setErrorHandler(function(err, req, res) {
      t.type(req, 'object')
      res.send('an error happened: ' + err.message)
    })

  request(app, '/test', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'an error happened: kaboom')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom error handler with hooks', (t) => {
  t.plan(7)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('kaboom'))
  })

  app.setErrorHandler((err, req, res) => {
    res.send('an error happened: ' + err.message)
  })

  app.addHook('onRequest', (req, res, next) => {
    t.ok('called', 'onRequest')
    next()
  })
  app.addHook('onSend', (req, res, body, next) => {
    t.ok('called', 'onSend')
    next()
  })
  app.addHook('onFinished', () => {
    t.ok('called', 'onFinished')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'an error happened: kaboom')
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

  app.get('/', (req, res) => {
    res.error(new Error('kaboom'))
  })

  app.setErrorHandler((err) => {
    return Promise.resolve('Error: ' + err.message)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.strictEqual(res.body, 'Error: kaboom')
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

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.body).message, 'Custom error handler rejection')
  })
})

test('async custom error handler can still use .send()', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('kaboom'))
  })

  app.setErrorHandler((err, req, res) => {
    res.send('Error: ' + err.message)
    return Promise.resolve()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'Error: kaboom')
  })
})

test('the Content-Type header should be unset before calling a custom error handler', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.type('application/json')
    res.error(new Error('error message')) // Cause the error handler to be invoked
  })

  app.setErrorHandler((err, req, res) => {
    res.status(500).send(err.message)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.body, 'error message')
  })
})
