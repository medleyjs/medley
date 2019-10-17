'use strict'

const {test} = require('tap')
const medley = require('..')
const request = require('./utils/request')

test('default onError hook', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', function(req, res) {
    res.error(new Error('kaboom'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictEqual(res.headers['content-length'], '69')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('default onError hook uses the error’s status code', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/400', (req, res) => {
    res.error(Object.assign(new Error('error1'), {status: 400}))
  })

  app.get('/599', (req, res) => {
    res.error(Object.assign(new Error('error2'), {statusCode: 599}))
  })

  request(app, '/400', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Bad Request',
      message: 'error1',
      statusCode: 400,
    })
  })

  request(app, '/599', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 599)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: '599 Error',
      message: 'error2',
      statusCode: 599,
    })
  })
})

test('default onError hook only allows error status codes', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/399', (req, res) => {
    res.error(Object.assign(new Error('error1'), {status: 399}))
  })

  app.get('/600', (req, res) => {
    res.error(Object.assign(new Error('error2'), {statusCode: 600}))
  })

  request(app, '/399', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'error1',
      statusCode: 500,
    })
  })

  request(app, '/600', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'error2',
      statusCode: 500,
    })
  })
})

test('default onError hook triggers onSend hooks', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.error(new Error('kaboom'))
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.strictDeepEqual(JSON.parse(body), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
    next()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})

test('custom onError hook', (t) => {
  t.plan(5)

  const app = medley()
  const error = new Error('kaboom')

  app.get('/', function(req, res) {
    res.error(error)
  })

  app.addHook('onError', function(err, req, res) {
    t.equal(err, error)
    res.status(503).send('an error happened: ' + err.message)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'an error happened: kaboom')
  })
})

test('encapsulated onError hook', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', function(req, response) {
    response.error(new Error('kaboom'))
  })

  app.createSubApp('/test')
    .get('/', function(req, res) {
      res.error(new Error('kaboom'))
    })
    .addHook('onError', function(err, req, res) {
      res.status(500).send('an error happened: ' + err.message)
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

  request(app, '/test/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'an error happened: kaboom')
  })
})

test('hook order with a custom onError hook', (t) => {
  t.plan(10)

  const app = medley()
  let order = 0

  app.addHook('onRequest', (req, res, next) => {
    t.equal(order++, 0)
    next()
  })

  app.get('/', (req, res) => {
    t.equal(order++, 1)
    res.error(new Error('kaboom'))
  })

  app.addHook('onError', (err, req, res) => {
    t.equal(order++, 2)
    res.status(500).send('an error happened: ' + err.message)
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.equal(order++, 3)
    t.equal(body, 'an error happened: kaboom')
    next()
  })
  app.addHook('onFinished', () => {
    t.equal(order++, 4)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.deepEqual(res.body, 'an error happened: kaboom')
  })
})

test('async onError hook can send a response by returning a value', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('promise error'))
  })
  app.addHook('onError', (err, req, res) => {
    res.statusCode = 500
    return Promise.resolve('Error: ' + err.message)
  })

  app.createSubApp('/async')
    .get('/', (req, res) => {
      res.error(new Error('async error'))
    })
    .addHook('onError', async (err, req, res) => {
      res.statusCode = 500
      return 'Error: ' + err.message
    })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.strictEqual(res.body, 'Error: promise error')
  })

  request(app, '/async/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.strictEqual(res.body, 'Error: async error')
  })
})

test('onError hook can defer to the next onError hook with next()', (t) => {
  t.plan(6)

  const app = medley()
  const error = new Error('kaboom')

  app.get('/', (req, res) => {
    res.error(error)
  })

  app.addHook('onError', (err, req, res, next) => {
    t.equal(err, error)
    next()
  })
  app.addHook('onError', (err, req, res, next) => {
    t.equal(err, error)
    next()
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

test('async onError hook can defer to the next onError hook by not returning a value', (t) => {
  t.plan(6)

  const error = new Error('kaboom')
  const app = medley()

  app.get('/', (req, res) => {
    res.error(error)
  })

  app.addHook('onError', (err) => {
    t.equal(err, error)
    return Promise.resolve()
  })
  app.addHook('onError', async (err) => {
    t.equal(err, error)
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

test('onError hook can change the error with next(error)', (t) => {
  t.plan(6)

  const app = medley()
  const error1 = new Error('error1')
  const error2 = new Error('error2')
  const error3 = new Error('error3')

  app.get('/', (req, res) => {
    res.error(error1)
  })

  app.addHook('onError', (err, req, res, next) => {
    t.equal(err, error1)
    next(error2)
  })
  app.addHook('onError', (err, req, res, next) => {
    t.equal(err, error2)
    next(error3)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'error3',
      statusCode: 500,
    })
  })
})

test('async onError hook can modify the error by rejecting/throwing', (t) => {
  t.plan(6)

  const app = medley()
  const error1 = new Error('error1')
  const error2 = new Error('error2')
  const error3 = new Error('error3')

  app.get('/', (req, res) => {
    res.error(error1)
  })

  app.addHook('onError', (err) => {
    t.equal(err, error1)
    return Promise.reject(error2)
  })
  app.addHook('onError', async (err) => {
    t.equal(err, error2)
    throw error3
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'error3',
      statusCode: 500,
    })
  })
})

test('the Content-Type header should be unset before calling a custom onError hook', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.type('application/json')
    res.error(new Error('error message'))
  })

  app.addHook('onError', (err, req, res) => {
    res.status(500).send(err.message)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.body, 'error message')
  })
})

test('the Content-Type header should not affect the default onError hook', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.type('text/html')
    res.error(new Error('error message'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'error message',
      statusCode: 500,
    })
  })
})
