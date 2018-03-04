'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('Prefix options should add a prefix for all the routes inside a register / 1', t => {
  t.plan(6)
  const app = medley()

  app.get('/first', (req, reply) => {
    reply.send({route: '/first'})
  })

  app.register(function(app, opts, next) {
    app.get('/first', (req, reply) => {
      reply.send({route: '/v1/first'})
    })

    app.register(function(app, opts, next) {
      app.get('/first', (req, reply) => {
        reply.send({route: '/v1/v2/first'})
      })
      next()
    }, {prefix: '/v2'})

    next()
  }, {prefix: '/v1'})

  app.inject({
    method: 'GET',
    url: '/first',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/first'})
  })

  app.inject({
    method: 'GET',
    url: '/v1/first',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/first'})
  })

  app.inject({
    method: 'GET',
    url: '/v1/v2/first',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/v2/first'})
  })
})

test('Prefix options should add a prefix for all the routes inside a register / 2', t => {
  t.plan(4)
  const app = medley()

  app.register(function(app, opts, next) {
    app.get('/first', (req, reply) => {
      reply.send({route: '/v1/first'})
    })

    app.get('/second', (req, reply) => {
      reply.send({route: '/v1/second'})
    })
    next()
  }, {prefix: '/v1'})

  app.inject({
    method: 'GET',
    url: '/v1/first',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/first'})
  })

  app.inject({
    method: 'GET',
    url: '/v1/second',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/second'})
  })
})

test('Prefix options should add a prefix for all the chained routes inside a register / 3', t => {
  t.plan(4)

  const app = medley()

  app.register(function(app, opts, next) {
    app
      .get('/first', (req, reply) => {
        reply.send({route: '/v1/first'})
      })
      .get('/second', (req, reply) => {
        reply.send({route: '/v1/second'})
      })
    next()
  }, {prefix: '/v1'})

  app.inject({
    method: 'GET',
    url: '/v1/first',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/first'})
  })

  app.inject({
    method: 'GET',
    url: '/v1/second',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/second'})
  })
})

test('Prefix should support parameters as well', t => {
  t.plan(2)
  const app = medley()

  app.register(function(app, opts, next) {
    app.get('/hello', (req, reply) => {
      reply.send({id: req.params.id})
    })
    next()
  }, {prefix: '/v1/:id'})

  app.inject({
    method: 'GET',
    url: '/v1/param/hello',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {id: 'param'})
  })
})

test('Prefix should support /', t => {
  t.plan(2)
  const app = medley()

  app.register(function(app, opts, next) {
    app.get('/', (req, reply) => {
      reply.send({hello: 'world'})
    })
    next()
  }, {prefix: '/v1'})

  app.inject({
    method: 'GET',
    url: '/v1',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Prefix without /', t => {
  t.plan(2)
  const app = medley()

  app.register(function(app, opts, next) {
    app.get('/', (req, reply) => {
      reply.send({hello: 'world'})
    })
    next()
  }, {prefix: 'v1'})

  app.inject({
    method: 'GET',
    url: '/v1',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Prefix with trailing /', t => {
  t.plan(6)
  const app = medley()

  app.register(function(app, opts, next) {
    app.get('/route1', (req, reply) => {
      reply.send({hello: 'world1'})
    })
    app.get('route2', (req, reply) => {
      reply.send({hello: 'world2'})
    })

    app.register(function(app, opts, next) {
      app.get('/route3', (req, reply) => {
        reply.send({hello: 'world3'})
      })
      next()
    }, {prefix: '/inner/'})

    next()
  }, {prefix: '/v1/'})

  app.inject({
    method: 'GET',
    url: '/v1/route1',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world1'})
  })

  app.inject({
    method: 'GET',
    url: '/v1/route2',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world2'})
  })

  app.inject({
    method: 'GET',
    url: '/v1/inner/route3',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world3'})
  })
})

test('Prefix works multiple levels deep', t => {
  t.plan(2)
  const app = medley()

  app.register(function(app, opts, next) {
    app.register(function(app, opts, next) {
      app.register(function(app, opts, next) {
        app.register(function(app, opts, next) {
          app.get('/', (req, reply) => {
            reply.send({hello: 'world'})
          })
          next()
        }, {prefix: '/v3'})
        next()
      }) // No prefix on this level
      next()
    }, {prefix: 'v2'})
    next()
  }, {prefix: '/v1'})

  app.inject({
    method: 'GET',
    url: '/v1/v2/v3',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Different register - encapsulation check', t => {
  t.plan(4)
  const app = medley()

  app.get('/first', (req, reply) => {
    reply.send({route: '/first'})
  })

  app.register(function(instance, opts, next) {
    instance.register(function(f, opts, next) {
      f.get('/', (req, reply) => {
        reply.send({route: '/v1/v2'})
      })
      next()
    }, {prefix: '/v2'})
    next()
  }, {prefix: '/v1'})

  app.register(function(instance, opts, next) {
    instance.register(function(f, opts, next) {
      f.get('/', (req, reply) => {
        reply.send({route: '/v3/v4'})
      })
      next()
    }, {prefix: '/v4'})
    next()
  }, {prefix: '/v3'})

  app.inject({
    method: 'GET',
    url: '/v1/v2',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/v2'})
  })

  app.inject({
    method: 'GET',
    url: '/v3/v4',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v3/v4'})
  })
})

test('Can retrieve basePath within encapsulated instances', t => {
  t.plan(4)
  const app = medley()

  app.register(function(instance, opts, next) {
    instance.get('/one', function(req, reply) {
      reply.send(instance.basePath)
    })

    instance.register(function(instance, opts, next) {
      instance.get('/two', function(req, reply) {
        reply.send(instance.basePath)
      })
      next()
    }, {prefix: '/v2'})

    next()
  }, {prefix: '/v1'})

  app.inject({
    method: 'GET',
    url: '/v1/one',
  }, (err, res) => {
    t.error(err)
    t.is(res.payload, '/v1')
  })

  app.inject({
    method: 'GET',
    url: '/v1/v2/two',
  }, (err, res) => {
    t.error(err)
    t.is(res.payload, '/v1/v2')
  })
})
