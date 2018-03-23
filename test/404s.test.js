'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')

const {methodHandlers} = require('../lib/RequestHandlers')

test('default 404', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.inject({
    method: 'HEAD',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Not Found: HEAD /')
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

  app.get('/with-notFound', function(req, response) {
    response.notFound()
  })

  app.setNotFoundHandler(function(req, response) {
    response.status(404).send('this was not found')
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    t.test('unhandled method', (t) => {
      t.plan(3)
      sget({
        method: 'DELETE',
        url: 'http://localhost:' + app.server.address().port,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found')
      })
    })

    t.test('unsupported route', (t) => {
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

    t.test('with calling .notFound()', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/with-notFound',
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found')
      })
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
      t.equal(res.payload, `Not Found: ${method} /not-found`)
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
      t.equal(res.payload, `Custom Not Found: ${method} /not-found`)
    })
  })
})

test('setting a custom 404 handler multiple times is an error', (t) => {
  t.plan(6)

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

    app.use('/prefix', (subApp) => {
      subApp.setNotFoundHandler(() => {})

      t.throws(
        () => subApp.setNotFoundHandler(() => {}),
        new Error("Not found handler already set for app instance with prefix: '/prefix'")
      )
    })
  })

  t.test('at multiple levels', (t) => {
    t.plan(1)

    const app = medley()

    app.setNotFoundHandler(() => {})

    app.use((subApp) => {
      t.throws(
        () => subApp.setNotFoundHandler(() => {}),
        new Error("Not found handler already set for app instance with prefix: '/'")
      )
    })
  })

  t.test('at multiple levels > sub-app sets the not-found handler first', (t) => {
    t.plan(1)

    const app = medley()

    app.use((subApp) => {
      subApp.setNotFoundHandler(() => {})
    })

    t.throws(
      () => app.setNotFoundHandler(() => {}),
      new Error("Not found handler already set for app instance with prefix: '/'")
    )
  })

  t.test('at multiple levels / 2', (t) => {
    t.plan(1)

    const app = medley()

    app.setNotFoundHandler(() => {})

    app.use('/prefix', (subApp) => {
      subApp.setNotFoundHandler(() => {})

      subApp.use((subApp2) => {
        t.throws(
          () => subApp2.setNotFoundHandler(() => {}),
          new Error("Not found handler already set for app instance with prefix: '/prefix'")
        )
      })
    })
  })

  t.test('in separate plugins at the same level', (t) => {
    t.plan(1)

    const app = medley()

    app.use('/prefix', (subApp) => {
      subApp.use((subApp2A) => {
        subApp2A.setNotFoundHandler(() => {})
      })

      subApp.use((subApp2B) => {
        t.throws(
          () => subApp2B.setNotFoundHandler(() => {}),
          new Error("Not found handler already set for app instance with prefix: '/prefix'")
        )
      })
    })

    app.setNotFoundHandler(() => {})
  })
})

test('encapsulated 404', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, res) {
    res.status(404).send('this was not found')
  })

  app.use('/test', (subApp) => {
    subApp.setNotFoundHandler(function(req, res) {
      res.status(404).send('this was not found 2')
    })
  })

  app.use('/test2', (subApp) => {
    subApp.setNotFoundHandler(function(req, res) {
      res.status(404).send('this was not found 3')
    })
  })

  app.use('/test3/', (subApp) => {
    subApp.setNotFoundHandler(function(req, res) {
      res.status(404).send('this was not found 4')
    })
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    t.test('root unhandled method', (t) => {
      t.plan(3)
      sget({
        method: 'DELETE',
        url: 'http://localhost:' + app.server.address().port,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found')
      })
    })

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

  app.registerPlugin(plugin)

  app.get('/', (request, response) => {
    response.send({hello: 'world'})
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('this was not found')
  })

  app.registerPlugin(plugin) // Registering plugin after handler also works

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

  app.use('/test', (subApp) => {
    subApp.setNotFoundHandler((request, response) => {
      response.status(404).send('this was not found 2')
    })

    subApp.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest 2 called')
      next()
    })

    subApp.addHook('preHandler', function(request, response, next) {
      t.pass('preHandler 2 called')
      next()
    })

    subApp.addHook('onSend', function(request, response, payload, next) {
      t.pass('onSend 2 called')
      next()
    })

    subApp.addHook('onFinished', (request, response) => {
      t.ok(response, 'onFinished 2 called')
    })
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

test('encapsulated custom 404 without prefix has the right encapsulation context', (t) => {
  t.plan(17)

  const app = medley()

  app.decorateRequest('foo', 42)
  app.decorateResponse('foo', 42)

  app.use((subApp) => {
    subApp.decorateRequest('bar', 84)

    subApp.addHook('onRequest', (request, response, next) => {
      t.equal(request.foo, 42)
      t.equal(request.bar, 84)
      t.equal(response.foo, 42)
      next()
    })
    subApp.addHook('preHandler', (request, response, next) => {
      t.equal(request.foo, 42)
      t.equal(request.bar, 84)
      t.equal(response.foo, 42)
      next()
    })
    subApp.addHook('onSend', (request, response, payload, next) => {
      t.equal(request.foo, 42)
      t.equal(request.bar, 84)
      t.equal(response.foo, 42)
      next()
    })
    subApp.addHook('onFinished', (request, response) => {
      t.equal(request.foo, 42)
      t.equal(request.bar, 84)
      t.equal(response.foo, 42)
    })

    subApp.setNotFoundHandler((request, response) => {
      t.equal(request.foo, 42)
      t.equal(request.bar, 84)
      response.status(404).send('custom not found')
    })
  })

  app.inject('/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'custom not found')
  })
})

test('hooks check 404', (t) => {
  t.plan(13)

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

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'DELETE',
      url: 'http://localhost:' + app.server.address().port + '?foo=asd',
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/notSupported?foo=asd',
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('the default 404 handler can be invoked inside a prefixed plugin', (t) => {
  t.plan(4)

  const app = medley()

  app.use('/v1', (subApp) => {
    subApp.get('/path', (request, response) => {
      response.notFound()
    })
  })

  app.inject('/v1/path', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Not Found: GET /v1/path')
  })
})

test('an inherited custom 404 handler can be invoked inside a prefixed plugin', (t) => {
  t.plan(3)

  const app = medley()

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('custom handler')
  })

  app.use('/v1', (subApp) => {
    subApp.get('/path', (request, response) => {
      response.notFound()
    })
  })

  app.inject('/v1/path', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'custom handler')
  })
})

test('encapsulated custom 404 handler without a prefix is the handler for the entire 404 level', (t) => {
  t.plan(6)

  const app = medley()

  app.use((subApp) => {
    subApp.setNotFoundHandler((request, response) => {
      response.status(404).send('custom handler')
    })
  })

  app.use('/prefixed', (subApp) => {
    subApp.use((subApp2) => {
      subApp2.setNotFoundHandler((request, response) => {
        response.status(404).send('custom handler 2')
      })
    })
  })

  app.inject('/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'custom handler')
  })

  app.inject('/prefixed/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'custom handler 2')
  })
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

test('async not-found handler triggered by response.notFound()', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(request, response) {
    response.notFound()
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404)
    return Promise.resolve('Custom 404')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'Custom 404')
  })
})

test('the Content-Type header should be unset before calling a not-found handler', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    response.type('application/json')
    response.notFound()
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('plain text')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'plain text')
  })
})
