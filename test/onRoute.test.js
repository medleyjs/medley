'use strict'

const t = require('tap')
const medley = require('..')

t.test('onRoute hook should be called / 1', (t) => {
  t.plan(2)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', () => {
      t.pass()
    })
    subApp.get('/', opts, function(req, reply) {
      reply.send()
    })
    next()
  })

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should be called / 2', (t) => {
  t.plan(5)
  let firstHandler = 0
  let secondHandler = 0
  const app = medley()
  app.addHook('onRoute', () => {
    t.pass()
    firstHandler++
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', () => {
      t.pass()
      secondHandler++
    })
    subApp.get('/', opts, function(req, reply) {
      reply.send()
    })
    next()
  })
    .after(() => {
      t.strictEqual(firstHandler, 1)
      t.strictEqual(secondHandler, 1)
    })

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should be called / 3', (t) => {
  t.plan(6)
  const app = medley()

  function handler(req, reply) {
    reply.send()
  }

  app.addHook('onRoute', () => {
    t.pass()
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', () => {
      t.pass()
    })
    subApp.get('/a', handler)
    next()
  })
    .after((err, done) => {
      t.error(err)
      setTimeout(() => {
        app.get('/b', handler)
        done()
      }, 10)
    })

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should pass correct route', (t) => {
  t.plan(7)
  const app = medley()
  app.addHook('onRoute', (route) => {
    t.strictEqual(route.method, 'GET')
    t.strictEqual(route.url, '/')
    t.strictEqual(route.path, '/')
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', (route) => {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/')
      t.strictEqual(route.path, '/')
    })
    subApp.get('/', opts, function(req, reply) {
      reply.send()
    })
    next()
  })

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should pass correct route with custom prefix', (t) => {
  t.plan(9)
  const app = medley()
  app.addHook('onRoute', function(route) {
    t.strictEqual(route.method, 'GET')
    t.strictEqual(route.url, '/v1/foo')
    t.strictEqual(route.path, '/v1/foo')
    t.strictEqual(route.prefix, '/v1')
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', function(route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/v1/foo')
      t.strictEqual(route.path, '/v1/foo')
      t.strictEqual(route.prefix, '/v1')
    })
    subApp.get('/foo', opts, function(req, reply) {
      reply.send()
    })
    next()
  }, {prefix: '/v1'})

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should pass correct route with custom options', (t) => {
  t.plan(4)
  const app = medley()
  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', (route) => {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/foo')
      t.strictEqual(route.bodyLimit, 100)
    })
    subApp.get('/foo', {bodyLimit: 100}, (request, reply) => {
      reply.send()
    })
    next()
  })

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should receive any route option', (t) => {
  t.plan(4)
  const app = medley()
  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', function(route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/foo')
      t.strictEqual(route.auth, 'basic')
    })
    subApp.get('/foo', {auth: 'basic'}, function(req, reply) {
      reply.send()
    })
    next()
  })

  app.ready((err) => {
    t.error(err)
  })
})

t.test('onRoute hook should preserve system route configuration', (t) => {
  t.plan(4)
  const app = medley()
  app.register((subApp, opts, next) => {
    subApp.addHook('onRoute', function(route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/foo')
      t.strictEqual(route.handler.length, 2)
    })
    subApp.get('/foo', {url: '/bar', method: 'POST', handler: () => {}}, function(req, reply) {
      reply.send()
    })
    next()
  })

  app.ready((err) => {
    t.error(err)
  })
})
