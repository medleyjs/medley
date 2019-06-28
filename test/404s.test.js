'use strict'

const {test} = require('tap')
const http = require('http')
const h2url = require('h2url')
const request = require('./utils/request')
const medley = require('..')

const supportedMethods = http.METHODS.filter(method => method !== 'CONNECT')

test('Default 404 handler', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  request(app, '/not-defined', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.body, 'Not Found: GET /not-defined')
  })
})

test('Custom 404 handler', (t) => {
  t.plan(3)

  const app = medley({
    notFoundHandler: (req, res) => {
      res.status(404).send('this was not found')
    },
  })

  app.get('/', () => {
    t.fail('the handler should not be called')
  })

  request(app, '/notSupported', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'this was not found')
  })
})

test('Custom 404 handler - invalid type', (t) => {
  t.throws(
    () => medley({notFoundHandler: null}),
    new TypeError("'notFoundHandler' option must be a function. Got value of type 'object'")
  )
  t.throws(
    () => medley({notFoundHandler: true}),
    new TypeError("'notFoundHandler' option must be a function. Got value of type 'boolean'")
  )
  t.throws(
    () => medley({notFoundHandler: 'str'}),
    new TypeError("'notFoundHandler' option must be a function. Got value of type 'string'")
  )
  t.end()
})

test('The default 404 handler runs for all supported HTTP methods', (t) => {
  t.plan(4 * supportedMethods.length)

  const app = medley()

  app.all('/', () => {
    t.fail('Handler should not be called')
  })

  for (const method of supportedMethods) {
    request(app, {method, url: '/not-found'}, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')

      if (method === 'HEAD') {
        t.equal(res.body, '')
      } else {
        t.equal(res.body, `Not Found: ${method} /not-found`)
      }
    })
  }
})

test('Custom 404 handlers run for all supported HTTP methods', (t) => {
  t.plan(4 * supportedMethods.length)

  const app = medley({
    notFoundHandler: (req, res) => {
      res.status(404).send(`Custom Not Found: ${req.method} ${req.url}`)
    },
  })

  app.all('/', () => {
    t.fail('Handler should not be called')
  })

  for (const method of supportedMethods) {
    request(app, {method, url: '/not-found'}, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')

      if (method === 'HEAD') {
        t.equal(res.body, '')
      } else {
        t.equal(res.body, `Custom Not Found: ${method} /not-found`)
      }
    })
  }
})

test('Hooks on the root app run for the default 404 handler', (t) => {
  t.plan(5)

  const app = medley()

  app.addHook('onRequest', function(req, res, next) {
    t.pass('onRequest called')
    next()
  })

  app.addHook('onSend', function(req, res, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.ok(res, 'onFinished called')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
  })
})

test('Hooks on the root app run for custom 404 handlers', (t) => {
  t.plan(6)

  const app = medley({
    notFoundHandler: (req, res) => {
      res.status(404).send('this was not found')
    },
  })

  app.addHook('onRequest', function(req, res, next) {
    t.pass('onRequest called')
    next()
  })

  app.addHook('onSend', function(req, res, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.ok(res, 'onFinished called')
  })

  request(app, '/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'this was not found')
  })
})

test('Hooks on the root app run for 404 handlers (testing onError hooks)', (t) => {
  t.plan(7)

  const app = medley()
  const onRequestError = new Error('onRequest error')

  app.addHook('onRequest', (req, res, next) => {
    t.pass('onRequest called')
    next(onRequestError) // Because of this, the 404 handler doesn't get run
  })

  app.addHook('onError', (err, req, res) => {
    t.equal(err, onRequestError)
    res.status(500).send('onError response')
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.equal(body, 'onError response')
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.ok(res, 'onFinished called')
  })

  request(app, '/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.body, 'onError response')
  })
})

test('not-found requests with a body receive a 404 response', (t) => {
  t.plan(3)

  const app = medley()

  request(app, {
    method: 'POST',
    url: '/not-found',
    headers: {'Content-Type': 'application/json'},
    body: '{"hello":"world"}',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'Not Found: POST /not-found')
  })
})

test('not-found route lookups do not fail with the Accept-Version header', (t) => {
  t.plan(3)

  const app = medley({
    notFoundHandler: (req, res) => {
      res.status(404).send('not found')
    },
  })

  request(app, '/', {
    headers: {
      'Accept-Version': '1.0.0',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'not found')
  })
})

test('Sends a 404 for methods not supported by find-my-way', (t) => {
  t.plan(5)

  const app = medley({http2: true})

  app.all('/', () => {
    t.fail('The handler should not be called')
  })

  app.listen(0, 'localhost', async (err) => {
    app.server.unref()
    t.error(err)

    const res = await h2url.concat({
      method: 'TROLL',
      url: `http://localhost:${app.server.address().port}/`,
    })
    t.equal(res.headers[':status'], 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.headers['content-length'], '18')
    t.equal(res.body, 'Not Found: TROLL /')
  })
})

test('Calls the custom 404 handler for methods not supported by find-my-way', (t) => {
  t.plan(5)

  const app = medley({
    http2: true,
    notFoundHandler: (req, res) => {
      res.status(404).send(req.method + ' not found')
    },
  })

  app.all('/', () => {
    t.fail('The handler should not be called')
  })

  app.listen(0, 'localhost', async (err) => {
    app.server.unref()
    t.error(err)

    const res = await h2url.concat({
      method: 'TROLL',
      url: `http://localhost:${app.server.address().port}/`,
    })
    t.equal(res.headers[':status'], 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.headers['content-length'], '15')
    t.equal(res.body, 'TROLL not found')
  })
})
