'use strict'

const t = require('tap')
const test = t.test
const fp = require('fastify-plugin')
const httpErrors = require('http-errors')
const sget = require('simple-get').concat
const errors = require('http-errors')
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
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'Not Found: HEAD /')
  })

  app.inject({
    method: 'GET',
    url: '/not-defined',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'Not Found: GET /not-defined')
  })
})

test('customized 404', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.get('/with-error', function(req, response) {
    response.error(new errors.NotFound())
  })

  app.setNotFoundHandler(function(req, response) {
    response.status(404).send('this was not found')
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    t.test('unsupported method', (t) => {
      t.plan(3)
      sget({
        method: 'PUT',
        url: 'http://localhost:' + app.server.address().port,
        body: JSON.stringify({hello: 'world'}),
        headers: {'Content-Type': 'application/json'},
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

    t.test('with error object', (t) => {
      t.plan(3)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/with-error',
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
  t.plan(28)

  const app = medley()

  app.all('/', (request, response) => {
    response.send('Found')
  })

  Object.keys(methodHandlers).forEach((method) => {
    app.inject({method, url: '/not-found'}, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.headers['content-type'], 'text/plain')
      t.equal(res.payload, `Not Found: ${method} /not-found`)
    })
  })
})

test('has a custom 404 handler for all supported HTTP methods', (t) => {
  t.plan(28)

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
      t.equal(res.headers['content-type'], 'text/plain')
      t.equal(res.payload, `Custom Not Found: ${method} /not-found`)
    })
  })
})

test('setting a custom 404 handler multiple times is an error', (t) => {
  t.plan(5)

  t.test('at the root level', (t) => {
    t.plan(2)

    const app = medley()

    app.setNotFoundHandler(() => {})

    try {
      app.setNotFoundHandler(() => {})
      t.fail('setting multiple 404 handlers at the same prefix encapsulation level should throw')
    } catch (err) {
      t.type(err, Error)
      t.strictEqual(err.message, 'Not found handler already set for app instance with prefix: \'/\'')
    }
  })

  t.test('at the plugin level', (t) => {
    t.plan(3)

    const app = medley()

    app.register((subApp, options, next) => {
      subApp.setNotFoundHandler(() => {})

      try {
        subApp.setNotFoundHandler(() => {})
        t.fail('setting multiple 404 handlers at the same prefix encapsulation level should throw')
      } catch (err) {
        t.type(err, Error)
        t.strictEqual(err.message, 'Not found handler already set for app instance with prefix: \'/prefix\'')
      }

      next()
    }, {prefix: '/prefix'})

    app.listen(0, (err) => {
      t.error(err)
      app.close()
    })
  })

  t.test('at multiple levels', (t) => {
    t.plan(3)

    const app = medley()

    app.register((subApp, options, next) => {
      try {
        subApp.setNotFoundHandler(() => {})
        t.fail('setting multiple 404 handlers at the same prefix encapsulation level should throw')
      } catch (err) {
        t.type(err, Error)
        t.strictEqual(err.message, 'Not found handler already set for app instance with prefix: \'/\'')
      }
      next()
    })

    app.setNotFoundHandler(() => {})

    app.listen(0, (err) => {
      t.error(err)
      app.close()
    })
  })

  t.test('at multiple levels / 2', (t) => {
    t.plan(3)

    const app = medley()

    app.register((subApp, options, next) => {
      subApp.setNotFoundHandler(() => {})

      subApp.register((subApp2, options2, next) => {
        try {
          subApp2.setNotFoundHandler(() => {})
          t.fail('setting multiple 404 handlers at the same prefix encapsulation level should throw')
        } catch (err) {
          t.type(err, Error)
          t.strictEqual(err.message, 'Not found handler already set for app instance with prefix: \'/prefix\'')
        }
        next()
      })

      next()
    }, {prefix: '/prefix'})

    app.setNotFoundHandler(() => {})

    app.listen(0, (err) => {
      t.error(err)
      app.close()
    })
  })

  t.test('in separate plugins at the same level', (t) => {
    t.plan(3)

    const app = medley()

    app.register((subApp, options, next) => {
      subApp.register((subApp2A, opts, next) => {
        subApp2A.setNotFoundHandler(() => {})
        next()
      })

      subApp.register((subApp2B, opts, next) => {
        try {
          subApp2B.setNotFoundHandler(() => {})
          t.fail('setting multiple 404 handlers at the same prefix encapsulation level should throw')
        } catch (err) {
          t.type(err, Error)
          t.strictEqual(err.message, "Not found handler already set for app instance with prefix: '/prefix'")
        }
        next()
      })

      next()
    }, {prefix: '/prefix'})

    app.setNotFoundHandler(() => {})

    app.ready((err) => {
      t.error(err)
      app.close()
    })
  })
})

test('encapsulated 404', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, response) {
    response.status(404).send('this was not found')
  })

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(req, response) {
      response.status(404).send('this was not found 2')
    })
    next()
  }, {prefix: '/test'})

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(req, response) {
      response.status(404).send('this was not found 3')
    })
    next()
  }, {prefix: '/test2'})

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(request, response) {
      response.status(404).send('this was not found 4')
    })
    next()
  }, {prefix: '/test3/'})

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    t.test('root unsupported method', (t) => {
      t.plan(3)
      sget({
        method: 'PUT',
        url: 'http://localhost:' + app.server.address().port,
        body: JSON.stringify({hello: 'world'}),
        headers: {'Content-Type': 'application/json'},
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found')
      })
    })

    t.test('root insupported route', (t) => {
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

    t.test('unsupported method', (t) => {
      t.plan(3)
      sget({
        method: 'PUT',
        url: 'http://localhost:' + app.server.address().port + '/test',
        body: JSON.stringify({hello: 'world'}),
        headers: {'Content-Type': 'application/json'},
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

    t.test('unsupported method bis', (t) => {
      t.plan(3)
      sget({
        method: 'PUT',
        url: 'http://localhost:' + app.server.address().port + '/test2',
        body: JSON.stringify({hello: 'world'}),
        headers: {'Content-Type': 'application/json'},
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
        t.strictEqual(body.toString(), 'this was not found 3')
      })
    })

    t.test('unsupported route bis', (t) => {
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

    t.test('unsupported method 3', (t) => {
      t.plan(3)
      sget({
        method: 'PUT',
        url: 'http://localhost:' + app.server.address().port + '/test3/',
        body: JSON.stringify({hello: 'world'}),
        headers: {'Content-Type': 'application/json'},
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

  app.get('/', (request, response) => {
    response.send({hello: 'world'})
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'PUT',
      url: 'http://localhost:' + app.server.address().port,
      body: JSON.stringify({hello: 'world'}),
      headers: {'Content-Type': 'application/json'},
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('run non-encapsulated plugin hooks on default 404', (t) => {
  t.plan(6)

  const app = medley()

  app.register(fp(function(subApp, options, next) {
    subApp.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest called')
      next()
    })

    subApp.addHook('preHandler', function(request, response, next) {
      t.pass('preHandler called')
      next()
    })

    subApp.addHook('onSend', function(request, response, payload, next) {
      t.pass('onSend called')
      next()
    })

    subApp.addHook('onFinished', (request, response) => {
      t.ok(response, 'onFinished called')
    })

    next()
  }))

  app.get('/', (request, response) => {
    response.send({hello: 'world'})
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 404)
  })
})

test('run non-encapsulated plugin hooks on custom 404', (t) => {
  t.plan(11)

  const app = medley()

  const plugin = fp((subApp, opts, next) => {
    subApp.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest called')
      next()
    })

    subApp.addHook('preHandler', function(request, response, next) {
      t.pass('preHandler called')
      next()
    })

    subApp.addHook('onSend', function(request, response, payload, next) {
      t.pass('onSend called')
      next()
    })

    subApp.addHook('onFinished', (request, response) => {
      t.ok(response, 'onFinished called')
    })

    next()
  })

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

  app.register(function(f, opts, next) {
    f.setNotFoundHandler((request, response) => {
      response.status(404).send('this was not found 2')
    })

    f.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest 2 called')
      next()
    })

    f.addHook('preHandler', function(request, response, next) {
      t.pass('preHandler 2 called')
      next()
    })

    f.addHook('onSend', function(request, response, payload, next) {
      t.pass('onSend 2 called')
      next()
    })

    f.addHook('onFinished', (request, response) => {
      t.ok(response, 'onFinished 2 called')
    })

    next()
  }, {prefix: '/test'})

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'PUT',
      url: 'http://localhost:' + app.server.address().port + '/test',
      body: JSON.stringify({hello: 'world'}),
      headers: {'Content-Type': 'application/json'},
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

  app.register((subApp, opts, next) => {
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

    next()
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
      method: 'PUT',
      url: 'http://localhost:' + app.server.address().port + '?foo=asd',
      body: JSON.stringify({hello: 'world'}),
      headers: {'Content-Type': 'application/json'},
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

test('setNotFoundHandler should not suppress duplicated routes checking', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', function(request, response) {
    response.send({hello: 'world'})
  })

  app.get('/', function(request, response) {
    response.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(request, response) {
    response.status(404).send('this was not found')
  })

  app.listen(0, (err) => {
    t.ok(err)
  })
})

test('recognizes errors from the http-errors module', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', function(request, response) {
    response.error(httpErrors.NotFound())
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'Not Found: GET /')
  })
})

test('the default 404 handler can be invoked inside a prefixed plugin', (t) => {
  t.plan(4)

  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.get('/path', (request, response) => {
      response.error(httpErrors.NotFound())
    })

    next()
  }, {prefix: '/v1'})

  app.inject('/v1/path', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'Not Found: GET /v1/path')
  })
})

test('an inherited custom 404 handler can be invoked inside a prefixed plugin', (t) => {
  t.plan(3)

  const app = medley()

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('custom handler')
  })

  app.register((subApp, opts, next) => {
    subApp.get('/path', (request, response) => {
      response.error(httpErrors.NotFound())
    })

    next()
  }, {prefix: '/v1'})

  app.inject('/v1/path', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'custom handler')
  })
})

test('encapsulated custom 404 handler without a prefix is the handler for the entire 404 level', (t) => {
  t.plan(6)

  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.setNotFoundHandler((request, response) => {
      response.status(404).send('custom handler')
    })

    next()
  })

  app.register((subApp, opts, next) => {
    subApp.register((subApp2, opts, next) => {
      subApp2.setNotFoundHandler((request, response) => {
        response.status(404).send('custom handler 2')
      })
      next()
    })

    next()
  }, {prefix: 'prefixed'})

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

test('404 inside onSend', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(request, response) {
    response.send({hello: 'world'})
  })

  app.addHook('onSend', function(request, response, payload, next) {
    next(new errors.NotFound())
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

test('async not-found handler triggered by response.error(404)', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(request, response) {
    response.error(404, null)
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
    response.error(404, null)
  })

  app.setNotFoundHandler((request, response) => {
    response.status(404).send('plain text')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'plain text')
  })
})
