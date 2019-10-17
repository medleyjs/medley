'use strict'

const t = require('tap')
const h2url = require('h2url')
const medley = require('..')
const request = require('./utils/request')

t.test('Default 405 response for unset methods', (t) => {
  t.plan(10)

  const app = medley()

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  request(app, {
    method: 'DELETE',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.headers['content-length'], '28')
    t.equal(res.body, 'Method Not Allowed: DELETE /')
  })

  request(app, {
    method: 'POST',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.headers['content-length'], '26')
    t.equal(res.body, 'Method Not Allowed: POST /')
  })
})

t.test('Default 405 response for non-GET/HEAD routes', (t) => {
  t.plan(14)

  const app = medley()

  app.delete('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.route({
    method: ['PUT', 'POST'],
    path: '/user',
    handler(req, res) {
      res.send('hello')
    },
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'DELETE')
    t.equal(res.headers['content-length'], '25')
    t.equal(res.body, 'Method Not Allowed: GET /')
  })

  request(app, {
    method: 'HEAD',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'DELETE')
    t.equal(res.headers['content-length'], undefined)
    t.equal(res.body, '')
  })

  request(app, '/user', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'POST,PUT')
    t.equal(res.body, 'Method Not Allowed: GET /user')
  })
})

t.test('Sends a 405 response for unset methods that are plain object properties', (t) => {
  t.plan(9)

  const app = medley({http2: true})

  app.get('/', (req, res) => {
    res.send('hello')
  })

  app.listen(0, 'localhost', async (err) => {
    app.server.unref()
    t.error(err)

    const url = `http://localhost:${app.server.address().port}/`

    {
      const res = await h2url.concat({
        method: 'toString',
        url,
      })
      t.equal(res.headers[':status'], 405)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      t.equal(res.headers.allow, 'GET,HEAD')
      t.equal(res.body, 'Method Not Allowed: toString /')
    }

    {
      const res = await h2url.concat({
        method: '__proto__',
        url,
      })
      t.equal(res.headers[':status'], 405)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      t.equal(res.headers.allow, 'GET,HEAD')
      t.equal(res.body, 'Method Not Allowed: __proto__ /')
    }
  })
})

t.test('Hooks run on default 405 response', (t) => {
  t.plan(16)

  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.deepEqual(req.query, {foo: 'bar'})
    t.equal(res.headersSent, true)
  })

  request(app, {
    method: 'DELETE',
    url: '/?foo=bar',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'Method Not Allowed: DELETE /?foo=bar')
  })

  request(app, {
    method: 'POST',
    url: '/?foo=bar',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'Method Not Allowed: POST /?foo=bar')
  })
})

t.test('Sub-app hooks should *not* run for 405 responses', (t) => {
  t.plan(8)

  const app = medley()

  app.createSubApp()
    .addHook('onRequest', () => {
      t.fail('Sub-app hooks should not be called')
    })
    .addHook('onSend', () => {
      t.fail('Sub-app hooks should not be called')
    })
    .addHook('onFinished', () => {
      t.fail('Sub-app hooks should not be called')
    })
    .get('/', (req, res) => {
      res.send('GET response')
    })

  app.createSubApp()
    .addHook('onRequest', () => {
      t.fail('Sub-app hooks should not be called')
    })
    .addHook('onSend', () => {
      t.fail('Sub-app hooks should not be called')
    })
    .addHook('onFinished', () => {
      t.fail('Sub-app hooks should not be called')
    })
    .post('/user', (req, res) => {
      res.send('POST response')
    })

  request(app, {
    method: 'DELETE',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'Method Not Allowed: DELETE /')
  })

  request(app, {
    method: 'PUT',
    url: '/user',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'POST')
    t.equal(res.body, 'Method Not Allowed: PUT /user')
  })
})

t.test('Default 405 handler runs for requests with a non-standard method', (t) => {
  t.plan(5)

  const app = medley({http2: true})

  app.get('/', () => {
    t.fail('The handler should not be called')
  })

  app.listen(0, 'localhost', async (err) => {
    app.server.unref()
    t.error(err)

    const res = await h2url.concat({
      method: 'NONSTANDARD',
      url: `http://localhost:${app.server.address().port}/`,
    })
    t.equal(res.headers[':status'], 405)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'Method Not Allowed: NONSTANDARD /')
  })
})

t.test('Custom 405 handler - invalid type', (t) => {
  t.throws(
    () => medley({methodNotAllowedHandler: null}),
    new TypeError("'methodNotAllowedHandler' option must be a function. Got value of type 'object'")
  )
  t.throws(
    () => medley({methodNotAllowedHandler: true}),
    new TypeError("'methodNotAllowedHandler' option must be a function. Got value of type 'boolean'")
  )
  t.throws(
    () => medley({methodNotAllowedHandler: 'str'}),
    new TypeError("'methodNotAllowedHandler' option must be a function. Got value of type 'string'")
  )
  t.end()
})

t.test('Custom 405 Method Not Allowed handler', (t) => {
  t.plan(4)

  const app = medley({
    methodNotAllowedHandler: (req, res) => {
      res.headers.allow = res.config.allowedMethods.join(',')
      res.status(405).send('method not allowed')
    },
  })

  app.get('/', () => {
    t.fail('the handler should not be called')
  })

  request(app, {
    method: 'POST',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'method not allowed')
  })
})

t.test('Hooks run on custom 405 handler', (t) => {
  t.plan(16)

  const app = medley({
    methodNotAllowedHandler: (req, res) => {
      res.headers.allow = res.config.allowedMethods.join(',')
      res.status(405).send(`Not allowed: ${req.method} ${req.url}`)
    },
  })

  app.addHook('onRequest', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.deepEqual(req.query, {foo: 'bar'})
    t.equal(res.headersSent, true)
  })

  request(app, {
    method: 'DELETE',
    url: '/?foo=bar',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'Not allowed: DELETE /?foo=bar')
  })

  request(app, {
    method: 'POST',
    url: '/?foo=bar',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'Not allowed: POST /?foo=bar')
  })
})

t.test('Calls the custom 405 handler for non-standard methods', (t) => {
  t.plan(5)

  const app = medley({
    http2: true,
    methodNotAllowedHandler: (req, res) => {
      res.headers.allow = res.config.allowedMethods.join(',')
      res.status(405).send(req.method + ' method not allowed')
    },
  })

  app.get('/', () => {
    t.fail('The handler should not be called')
  })

  app.listen(0, 'localhost', async (err) => {
    app.server.unref()
    t.error(err)

    const res = await h2url.concat({
      method: 'NONSTANDARD',
      url: `http://localhost:${app.server.address().port}/`,
    })
    t.equal(res.headers[':status'], 405)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'NONSTANDARD method not allowed')
  })
})
