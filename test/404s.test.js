'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')

const {methodHandlers} = require('../lib/RequestHandlers')

test('default 404', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.inject({
    method: 'GET',
    url: '/not-defined',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Not Found: GET /not-defined')
  })
})

test('customized 404', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, response) {
    response.status(404).send('this was not found')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/notSupported',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(body.toString(), 'this was not found')
    })
  })
})

test('custom 404 handler accepts options', (t) => {
  t.plan(2)

  const app = medley()

  app.setNotFoundHandler({config: {a: 1}}, (request, response) => {
    response.send(response.route.config)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.payload), {a: 1})
  })
})

test('has a 404 handler for all supported HTTP methods', (t) => {
  t.plan(4 * Object.keys(methodHandlers).length)

  const app = medley()

  app.all('/', (request, response) => {
    response.send('Found')
  })

  Object.keys(methodHandlers).forEach((method) => {
    app.inject({method, url: '/not-found'}, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      if (method === 'HEAD') {
        t.equal(res.payload, '')
      } else {
        t.equal(res.payload, `Not Found: ${method} /not-found`)
      }
    })
  })
})

test('has a custom 404 handler for all supported HTTP methods', (t) => {
  t.plan(4 * Object.keys(methodHandlers).length)

  const app = medley()

  app.all('/', (request, response) => {
    response.send('Found')
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404).send(`Custom Not Found: ${request.method} ${request.url}`)
  })

  Object.keys(methodHandlers).forEach((method) => {
    app.inject({method, url: '/not-found'}, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      if (method === 'HEAD') {
        t.equal(res.payload, '')
      } else {
        t.equal(res.payload, `Custom Not Found: ${method} /not-found`)
      }
    })
  })
})

test('setting a custom 404 handler multiple times is an error', (t) => {
  t.plan(2)

  t.test('at the root level', (t) => {
    t.plan(1)

    const app = medley()

    app.setNotFoundHandler(() => {})

    t.throws(
      () => app.setNotFoundHandler(() => {}),
      new Error("Not found handler already set for app instance with prefix: '/'")
    )
  })

  t.test('at the sub-app level', (t) => {
    t.plan(1)

    const app = medley()
    const subApp = app.createSubApp('/prefix')

    subApp.setNotFoundHandler(() => {})

    t.throws(
      () => subApp.setNotFoundHandler(() => {}),
      new Error("Not found handler already set for app instance with prefix: '/prefix'")
    )
  })
})

test('encapsulated 404', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, res) {
    res.status(404).send('this was not found')
  })

  app.createSubApp('/test')
    .setNotFoundHandler(function(req, res) {
      res.status(404).send('this was not found 2')
    })

  app.createSubApp('/test2')
    .setNotFoundHandler(function(req, res) {
      res.status(404).send('this was not found 3')
    })

  app.createSubApp('/test3/')
    .setNotFoundHandler(function(req, res) {
      res.status(404).send('this was not found 4')
    })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    t.test('root unsupported route', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/notSupported',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found')
      })
    })

    t.test('unhandled method', (t) => {
      t.plan(3)
      sget({
        method: 'DELETE',
        url: 'http://localhost:' + app.server.address().port + '/test',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 2')
      })
    })

    t.test('unsupported route', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/test/notSupported',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 2')
      })
    })

    t.test('unhandled method 2', (t) => {
      t.plan(3)
      sget({
        method: 'DELETE',
        url: 'http://localhost:' + app.server.address().port + '/test2',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 3')
      })
    })

    t.test('unsupported route 2', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/test2/notSupported',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 3')
      })
    })

    t.test('unhandled method 3', (t) => {
      t.plan(3)
      sget({
        method: 'DELETE',
        url: 'http://localhost:' + app.server.address().port + '/test3/',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 4')
      })
    })

    t.test('unsupported route 3', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/test3/notSupported',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 4')
      })
    })
  })
})

test('run hooks on default 404', (t) => {
  t.plan(7)

  const app = medley()

  app.addHook('onRequest', function(req, res, next) {
    t.pass('onRequest called')
    next()
  })

  app.addHook('preHandler', function(request, response, next) {
    t.pass('preHandler called')
    next()
  })

  app.addHook('onSend', function(request, response, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onFinished', (request, response) => {
    t.ok(response, 'onFinished called')
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('run hooks on custom 404', (t) => {
  t.plan(11)

  const app = medley()

  function plugin(appInstance) {
    appInstance.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest called')
      next()
    })

    appInstance.addHook('preHandler', function(request, response, next) {
      t.pass('preHandler called')
      next()
    })

    appInstance.addHook('onSend', function(request, response, payload, next) {
      t.pass('onSend called')
      next()
    })

    appInstance.addHook('onFinished', (request, response) => {
      t.ok(response, 'onFinished called')
    })
  }

  app.register(plugin)

  app.get('/', (request, response) => {
    response.send({hello: 'world'})
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('this was not found')
  })

  app.register(plugin) // Registering plugin after handler also works

  app.inject({url: '/not-found'}, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 404)
    t.strictEqual(res.payload, 'this was not found')
  })
})

test('run hooks with encapsulated 404', (t) => {
  t.plan(11)

  const app = medley()

  app.addHook('onRequest', function(req, res, next) {
    t.pass('onRequest called')
    next()
  })

  app.addHook('preHandler', function(request, response, next) {
    t.pass('preHandler called')
    next()
  })

  app.addHook('onSend', function(request, response, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onFinished', (request, response) => {
    t.ok(response, 'onFinished called')
  })

  app.createSubApp('/test')
    .setNotFoundHandler((req, res) => {
      res.status(404).send('this was not found 2')
    })
    .addHook('onRequest', function(req, res, next) {
      t.pass('onRequest 2 called')
      next()
    })
    .addHook('preHandler', function(req, res, next) {
      t.pass('preHandler 2 called')
      next()
    })
    .addHook('onSend', function(req, res, payload, next) {
      t.pass('onSend 2 called')
      next()
    })
    .addHook('onFinished', (req, res) => {
      t.ok(res, 'onFinished 2 called')
    })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/test',
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('hooks check 404', (t) => {
  t.plan(7)

  const app = medley()

  app.get('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.addHook('onRequest', (request, response, next) => {
    t.deepEqual(request.query, {foo: 'asd'})
    next()
  })

  app.addHook('onSend', (request, response, payload, next) => {
    t.deepEqual(request.query, {foo: 'asd'})
    next()
  })

  app.addHook('onFinished', (request, response) => {
    t.deepEqual(request.query, {foo: 'asd'})
    t.ok(response, 'called onFinished')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/notSupported?foo=asd',
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('calling setNotFoundHandler() on a sub-app without a prefix is an error', (t) => {
  t.plan(2)

  const app = medley()
  const subApp = app.createSubApp()

  t.throws(
    () => subApp.setNotFoundHandler(() => {}),
    new Error('Cannot call "setNotFoundHandler()" on a sub-app created without a prefix')
  )

  const prefixedSubApp = app.createSubApp('/prefixed')
  const unprefixedSubApp = prefixedSubApp.createSubApp()

  t.throws(
    () => unprefixedSubApp.setNotFoundHandler(() => {}),
    new Error('Cannot call "setNotFoundHandler()" on a sub-app created without a prefix')
  )
})

test('cannot set notFoundHandler after binding', (t) => {
  t.plan(2)

  const app = medley()
  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    try {
      app.setNotFoundHandler(() => { })
      t.fail()
    } catch (e) {
      t.pass()
    }
  })
})

test('not-found requests with a body receive a 404 response', (t) => {
  t.plan(3)

  const app = medley()

  app.inject({
    method: 'POST',
    url: '/not-found',
    headers: {'Content-Type': 'application/json'},
    payload: '{"hello":"world"}',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'Not Found: POST /not-found')
  })
})

test('request bodies are not parsed for not-found routes', (t) => {
  t.plan(4)

  const app = medley()

  app.addBodyParser('application/json', () => {
    t.fail('body parser should not be called')
  })

  app.setNotFoundHandler((req, res) => {
    t.equal(req.body, undefined)
    res.status(404).send('not found')
  })

  app.inject({
    method: 'POST',
    url: '/not-found',
    headers: {'Content-Type': 'application/json'},
    payload: '{"hello":"world"}',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'not found')
  })
})

test('not-found route lookups do not fail with the Accept-Version header', (t) => {
  t.plan(3)

  medley()
    .setNotFoundHandler((req, res) => {
      res.status(404).send('not found')
    })
    .inject({
      url: '/',
      headers: {
        'Accept-Version': '1.0.0',
      },
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.payload, 'not found')
    })
})
