'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('Prefix options should add a prefix for all the routes inside a sub-app / 1', (t) => {
  t.plan(6)
  const app = medley()

  app.get('/first', (req, res) => {
    res.send({route: '/first'})
  })

  app.use('/v1', function(subApp) {
    subApp.get('/first', (req, res) => {
      res.send({route: '/v1/first'})
    })

    subApp.use('/v2', function(subApp2) {
      subApp2.get('/first', (req, res) => {
        res.send({route: '/v1/v2/first'})
      })
    })
  })

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

test('Prefix options should add a prefix for all the routes inside a sub-app / 2', (t) => {
  t.plan(4)
  const app = medley()

  app.use('/v1', function(subApp) {
    subApp.get('/first', (req, res) => {
      res.send({route: '/v1/first'})
    })

    subApp.get('/second', (req, res) => {
      res.send({route: '/v1/second'})
    })
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
    url: '/v1/second',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {route: '/v1/second'})
  })
})

test('Prefix should support parameters as well', (t) => {
  t.plan(2)
  const app = medley()

  app.use('/v1/:id', function(subApp) {
    subApp.get('/hello', (req, res) => {
      res.send({id: req.params.id})
    })
  })

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

  app.use('/v1', function(subApp) {
    subApp.get('/', (req, res) => {
      res.send({hello: 'world'})
    })
  })

  app.inject({
    method: 'GET',
    url: '/v1',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Prefix without leading /', (t) => {
  t.plan(2)
  const app = medley()

  app.use('v1', function(subApp) {
    subApp.get('/', (req, res) => {
      res.send({hello: 'world'})
    })
  })

  app.inject({
    method: 'GET',
    url: '/v1',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Prefix with trailing /', (t) => {
  t.plan(8)
  const app = medley()

  app.use('/v1/', function(subApp) {
    subApp.get('/route1', (req, res) => {
      res.send({hello: 'world1'})
    })
    subApp.get('route2', (req, res) => {
      res.send({hello: 'world2'})
    })

    subApp.use('/inner/', function(subApp2) {
      subApp2.get('/route3', (req, res) => {
        res.send({hello: 'world3'})
      })
    })

    subApp.use('inner2', function(subApp2) {
      subApp2.get('/route4', (req, res) => {
        res.send({hello: 'world4'})
      })
    })
  })

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

  app.inject({
    method: 'GET',
    url: '/v1/inner2/route4',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world4'})
  })
})

test('Prefix works multiple levels deep', (t) => {
  t.plan(2)
  const app = medley()

  app.use('/v1', function(subApp) {
    subApp.use('v2', function(subApp2) {
      subApp2.use(function(subApp3) { // No prefix on this level
        subApp3.use('/v3', function(subApp4) {
          subApp4.get('/', (req, res) => {
            res.send({hello: 'world'})
          })
        })
      })
    })
  })

  app.inject({
    method: 'GET',
    url: '/v1/v2/v3',
  }, (err, res) => {
    t.error(err)
    t.same(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Different sub-apps - encapsulation check', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/first', (req, res) => {
    res.send({route: '/first'})
  })

  app.use('/v1', function(subApp) {
    subApp.use('/v2', function(subApp2) {
      subApp2.get('/', (req, res) => {
        res.send({route: '/v1/v2'})
      })
    })
  })

  app.use('/v3', function(subApp) {
    subApp.use('/v4', function(subApp2) {
      subApp2.get('/', (req, res) => {
        res.send({route: '/v3/v4'})
      })
    })
  })

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

test('.basePath within an encapsulated app instance', (t) => {
  t.plan(2)
  const app = medley()

  app.use('/v1', (subApp) => {
    t.equal(subApp.basePath, '/v1')

    subApp.use('/v2', (subApp2) => {
      t.equal(subApp2.basePath, '/v1/v2')
    })
  })
})
