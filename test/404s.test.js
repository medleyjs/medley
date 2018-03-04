'use strict'

const t = require('tap')
const test = t.test
const fp = require('fastify-plugin')
const httpErrors = require('http-errors')
const sget = require('simple-get').concat
const errors = require('http-errors')
const medley = require('..')

test('default 404', (t) => {
  t.plan(3)

  const test = t.test
  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    test('unsupported method', (t) => {
      t.plan(2)
      sget({
        method: 'PUT',
        url: 'http://localhost:' + app.server.address().port,
        body: {},
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
      })
    })

    test('unsupported route', (t) => {
      t.plan(2)
      sget({
        method: 'GET',
        url: 'http://localhost:' + app.server.address().port + '/notSupported',
        body: {},
        json: true,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
      })
    })
  })
})

test('customized 404', (t) => {
  t.plan(4)

  const test = t.test
  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.get('/with-error', function(req, reply) {
    reply.send(new errors.NotFound())
  })

  app.setNotFoundHandler(function(req, reply) {
    reply.code(404).send('this was not found')
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    test('unsupported method', (t) => {
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

    test('unsupported route', (t) => {
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

    test('with error object', (t) => {
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

test('setting a custom 404 handler multiple times is an error', (t) => {
  t.plan(4)

  t.test('at the root level', (t) => {
    t.plan(2)

    const app = medley()

    app.setNotFoundHandler(() => {})

    try {
      app.setNotFoundHandler(() => {})
      t.fail('setting multiple 404 handlers at the same prefix encapsulation level should throw')
    } catch (err) {
      t.type(err, Error)
      t.strictEqual(err.message, 'Not found handler already set for sub app with prefix: \'/\'')
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
        t.strictEqual(err.message, 'Not found handler already set for sub app with prefix: \'/prefix\'')
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
        t.strictEqual(err.message, 'Not found handler already set for sub app with prefix: \'/\'')
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
          t.strictEqual(err.message, 'Not found handler already set for sub app with prefix: \'/prefix\'')
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
})

test('encapsulated 404', (t) => {
  t.plan(9)

  const test = t.test
  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, reply) {
    reply.code(404).send('this was not found')
  })

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(req, reply) {
      reply.code(404).send('this was not found 2')
    })
    next()
  }, {prefix: '/test'})

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(req, reply) {
      reply.code(404).send('this was not found 3')
    })
    next()
  }, {prefix: '/test2'})

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(request, reply) {
      reply.code(404).send('this was not found 4')
    })
    next()
  }, {prefix: '/test3/'})

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    test('root unsupported method', (t) => {
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

    test('root insupported route', (t) => {
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

    test('unsupported method', (t) => {
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

    test('unsupported route', (t) => {
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

    test('unsupported method bis', (t) => {
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

    test('unsupported route bis', (t) => {
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

    test('unsupported method 3', (t) => {
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

    test('unsupported route 3', (t) => {
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

  app.addHook('preHandler', function(request, reply, next) {
    t.pass('preHandler called')
    next()
  })

  app.addHook('onSend', function(request, reply, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onResponse', function(res, next) {
    t.pass('onResponse called')
    next()
  })

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'PUT',
      url: 'http://localhost:' + app.server.address().port,
      body: JSON.stringify({hello: 'world'}),
      headers: {'Content-Type': 'application/json'},
    }, (err, response, body) => {
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

    subApp.addHook('preHandler', function(request, reply, next) {
      t.pass('preHandler called')
      next()
    })

    subApp.addHook('onSend', function(request, reply, payload, next) {
      t.pass('onSend called')
      next()
    })

    subApp.addHook('onResponse', function(res, next) {
      t.pass('onResponse called')
      next()
    })

    next()
  }))

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
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

    subApp.addHook('preHandler', function(request, reply, next) {
      t.pass('preHandler called')
      next()
    })

    subApp.addHook('onSend', function(request, reply, payload, next) {
      t.pass('onSend called')
      next()
    })

    subApp.addHook('onResponse', function(res, next) {
      t.pass('onResponse called')
      next()
    })

    next()
  })

  app.register(plugin)

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, reply) {
    reply.code(404).send('this was not found')
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

  app.addHook('preHandler', function(request, reply, next) {
    t.pass('preHandler called')
    next()
  })

  app.addHook('onSend', function(request, reply, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onResponse', function(res, next) {
    t.pass('onResponse called')
    next()
  })

  app.register(function(f, opts, next) {
    f.setNotFoundHandler(function(req, reply) {
      reply.code(404).send('this was not found 2')
    })

    f.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest 2 called')
      next()
    })

    f.addHook('preHandler', function(request, reply, next) {
      t.pass('preHandler 2 called')
      next()
    })

    f.addHook('onSend', function(request, reply, payload, next) {
      t.pass('onSend 2 called')
      next()
    })

    f.addHook('onResponse', function(res, next) {
      t.pass('onResponse 2 called')
      next()
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
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('hooks check 404', (t) => {
  t.plan(13)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.addHook('onSend', (req, reply, payload, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    t.ok('called', 'onSend')
    next()
  })
  app.addHook('onRequest', (req, res, next) => {
    t.ok('called', 'onRequest')
    next()
  })
  app.addHook('onResponse', (res, next) => {
    t.ok('called', 'onResponse')
    next()
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'PUT',
      url: 'http://localhost:' + app.server.address().port + '?foo=asd',
      body: JSON.stringify({hello: 'world'}),
      headers: {'Content-Type': 'application/json'},
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/notSupported?foo=asd',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('setNotFoundHandler should not suppress duplicated routes checking', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, reply) {
    reply.code(404).send('this was not found')
  })

  app.listen(0, (err) => {
    t.ok(err)
  })
})

test('Unsupported method', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    app.inject({
      method: 'PROPFIND',
      url: '/',
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 404)

      sget({
        method: 'PROPFIND',
        url: 'http://localhost:' + app.server.address().port,
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 404)
      })
    })
  })
})

test('recognizes errors from the http-errors module', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.send(httpErrors.NotFound())
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    app.inject({
      method: 'GET',
      url: '/',
    }, (err, res) => {
      t.error(err)
      t.strictEqual(res.statusCode, 404)

      sget('http://localhost:' + app.server.address().port, (err, response, body) => {
        t.error(err)
        const obj = JSON.parse(body.toString())
        t.strictDeepEqual(obj, {
          error: 'Not Found',
          message: 'Not found',
          statusCode: 404,
        })
      })
    })
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

  var called = false

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.addHook('onSend', function(request, reply, payload, next) {
    if (!called) {
      called = true
      next(new errors.NotFound())
    } else {
      next()
    }
  })

  t.tearDown(app.close.bind(app))

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})
