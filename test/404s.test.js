'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

const {methodHandlers} = require('../lib/RequestHandlers')

test('default 404', (t) => {
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

test('customized 404', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  app.setNotFoundHandler(function(req, res) {
    res.status(404).send('this was not found')
  })

  request(app, '/notSupported', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'this was not found')
  })
})

test('custom 404 handler accepts options', (t) => {
  t.plan(2)

  const app = medley()

  app.setNotFoundHandler({config: {a: 1}}, (req, res) => {
    res.send(res.route.config)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {a: 1})
  })
})

test('has a 404 handler for all supported HTTP methods', (t) => {
  t.plan(4 * Object.keys(methodHandlers).length)

  const app = medley()

  app.all('/', (req, res) => {
    res.send('Found')
  })

  for (const method of Object.keys(methodHandlers)) {
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

test('has a custom 404 handler for all supported HTTP methods', (t) => {
  t.plan(4 * Object.keys(methodHandlers).length)

  const app = medley()

  app.all('/', (req, res) => {
    res.send('Found')
  })

  app.setNotFoundHandler((req, res) => {
    res.status(404).send(`Custom Not Found: ${req.method} ${req.url}`)
  })

  for (const method of Object.keys(methodHandlers)) {
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
  t.plan(7)

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

  t.test('root unsupported route', (t) => {
    t.plan(3)
    request(app, '/notSupported', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found')
    })
  })

  t.test('unhandled method', (t) => {
    t.plan(3)
    request(app, {
      method: 'DELETE',
      url: '/test',
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found 2')
    })
  })

  t.test('unsupported route', (t) => {
    t.plan(3)
    request(app, '/test/notSupported', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found 2')
    })
  })

  t.test('unhandled method 2', (t) => {
    t.plan(3)
    request(app, {
      method: 'DELETE',
      url: '/test2',
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found 3')
    })
  })

  t.test('unsupported route 2', (t) => {
    t.plan(3)
    request(app, '/test2/notSupported', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found 3')
    })
  })

  t.test('unhandled method 3', (t) => {
    t.plan(3)
    request(app, {
      method: 'DELETE',
      url: '/test3/',
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found 4')
    })
  })

  t.test('unsupported route 3', (t) => {
    t.plan(3)
    request(app, '/test3/notSupported', (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 404)
      t.equal(res.body, 'this was not found 4')
    })
  })
})

test('run hooks on default 404', (t) => {
  t.plan(6)

  const app = medley()

  app.addHook('onRequest', function(req, res, next) {
    t.pass('onRequest called')
    next()
  })

  app.addHook('preHandler', function(req, res, next) {
    t.pass('preHandler called')
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

test('run hooks on custom 404', (t) => {
  t.plan(11)

  const app = medley()

  function plugin(appInstance) {
    appInstance.addHook('onRequest', function(req, res, next) {
      t.pass('onRequest called')
      next()
    })

    appInstance.addHook('preHandler', function(req, res, next) {
      t.pass('preHandler called')
      next()
    })

    appInstance.addHook('onSend', function(req, res, payload, next) {
      t.pass('onSend called')
      next()
    })

    appInstance.addHook('onFinished', (req, res) => {
      t.ok(res, 'onFinished called')
    })
  }

  app.register(plugin)

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.setNotFoundHandler((req, res) => {
    res.status(404).send('this was not found')
  })

  app.register(plugin) // Registering plugin after handler also works

  request(app, '/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'this was not found')
  })
})

test('run hooks with encapsulated 404', (t) => {
  t.plan(10)

  const app = medley()

  app.addHook('onRequest', function(req, res, next) {
    t.pass('onRequest called')
    next()
  })

  app.addHook('preHandler', function(req, res, next) {
    t.pass('preHandler called')
    next()
  })

  app.addHook('onSend', function(req, res, payload, next) {
    t.pass('onSend called')
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.ok(res, 'onFinished called')
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

  request(app, '/test', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
  })
})

test('hooks check 404', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  app.addHook('onRequest', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.addHook('onSend', (req, res, payload, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.deepEqual(req.query, {foo: 'asd'})
    t.ok(res, 'called onFinished')
  })

  request(app, '/notSupported?foo=asd', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
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

test('not-found requests with a body receive a 404 res', (t) => {
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

  request(app, {
    method: 'POST',
    url: '/not-found',
    headers: {'Content-Type': 'application/json'},
    body: '{"hello":"world"}',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'not found')
  })
})

test('not-found route lookups do not fail with the Accept-Version header', (t) => {
  t.plan(3)

  const app = medley()

  app.setNotFoundHandler((req, res) => {
    res.status(404).send('not found')
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
