'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('Prefix options should add a prefix for all the routes inside a register / 1', (t) => {
  t.plan(6)
  const app = medley()

  app.get('/first', (request, response) => {
    response.send({route: '/first'})
  })

  app.register(function(subApp, opts, next) {
    subApp.get('/first', (request, response) => {
      response.send({route: '/v1/first'})
    })

    subApp.register(function(subApp2, opts, next) {
      subApp2.get('/first', (request, response) => {
        response.send({route: '/v1/v2/first'})
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

test('Prefix options should add a prefix for all the routes inside a register / 2', (t) => {
  t.plan(4)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/first', (request, response) => {
      response.send({route: '/v1/first'})
    })

    subApp.get('/second', (request, response) => {
      response.send({route: '/v1/second'})
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

test('Prefix options should add a prefix for all the chained routes inside a register / 3', (t) => {
  t.plan(4)

  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp
      .get('/first', (request, response) => {
        response.send({route: '/v1/first'})
      })
      .get('/second', (request, response) => {
        response.send({route: '/v1/second'})
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

test('Prefix should support parameters as well', (t) => {
  t.plan(2)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/hello', (request, response) => {
      response.send({id: request.params.id})
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

test('Prefix should support /', (t) => {
  t.plan(2)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/', (request, response) => {
      response.send({hello: 'world'})
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

test('Prefix without /', (t) => {
  t.plan(2)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/', (request, response) => {
      response.send({hello: 'world'})
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

test('Prefix with trailing /', (t) => {
  t.plan(6)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/route1', (request, response) => {
      response.send({hello: 'world1'})
    })
    subApp.get('route2', (request, response) => {
      response.send({hello: 'world2'})
    })

    subApp.register(function(subApp2, opts, next) {
      subApp2.get('/route3', (request, response) => {
        response.send({hello: 'world3'})
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

test('Prefix works multiple levels deep', (t) => {
  t.plan(2)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.register(function(subApp2, opts, next) {
      subApp2.register(function(subApp3, opts, next) {
        subApp3.register(function(subApp4, opts, next) {
          subApp4.get('/', (request, response) => {
            response.send({hello: 'world'})
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

test('Different register - encapsulation check', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/first', (request, response) => {
    response.send({route: '/first'})
  })

  app.register(function(subApp, opts, next) {
    subApp.register(function(f, opts, next) {
      f.get('/', (request, response) => {
        response.send({route: '/v1/v2'})
      })
      next()
    }, {prefix: '/v2'})
    next()
  }, {prefix: '/v1'})

  app.register(function(subApp, opts, next) {
    subApp.register(function(f, opts, next) {
      f.get('/', (request, response) => {
        response.send({route: '/v3/v4'})
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

test('Can retrieve basePath within an encapsulated app instance', (t) => {
  t.plan(4)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/one', function(request, response) {
      response.send(subApp.basePath)
    })

    subApp.register(function(subApp2, opts, next) {
      subApp2.get('/two', function(request, response) {
        response.send(subApp2.basePath)
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
