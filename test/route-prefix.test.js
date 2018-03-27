'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('route without a prefix', (t) => {
  t.plan(4)

  const app1 = medley()
  app1.get('', (req, res) => {
    res.send('empty string')
  })
  app1.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'empty string')
  })

  const app2 = medley()
  app2.get('/', (req, res) => {
    res.send('slash path')
  })
  app2.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'slash path')
  })
})

test('prefix joined with "/" route path when strictRouting=false', (t) => {
  t.plan(4)

  const app = medley({strictRouting: false})

  app.use('/v1', function(subApp) {
    subApp.get('/', (req, res) => {
      res.send('payload')
    })
  })

  app.inject('/v1', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'payload')
  })

  app.inject('/v1/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'payload')
  })
})

test('prefix joined with "" and "/" route path when strictRouting=true', (t) => {
  t.plan(4)

  const app = medley({strictRouting: true})

  app.use('/v1', function(subApp) {
    subApp.get('', (req, res) => {
      res.send('no slash')
    })

    subApp.get('/', (req, res) => {
      res.send('with slash')
    })
  })

  app.inject('/v1', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'no slash')
  })

  app.inject('/v1/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'with slash')
  })
})

test('prefix is "" or "/"', (t) => {
  t.plan(8)

  const app = medley()

  app.use('/', function(subApp) {
    subApp.get('first', (req, res) => {
      res.send('1')
    })

    subApp.get('/second', (req, res) => {
      res.send('2')
    })
  })

  app.use('', function(subApp) {
    subApp.get('third', (req, res) => {
      res.send('3')
    })

    subApp.get('/fourth', (req, res) => {
      res.send('4')
    })
  })

  app.inject('/first', (err, res) => {
    t.error(err)
    t.equal(res.payload, '1')
  })

  app.inject('/second', (err, res) => {
    t.error(err)
    t.equal(res.payload, '2')
  })

  app.inject('/third', (err, res) => {
    t.error(err)
    t.equal(res.payload, '3')
  })

  app.inject('/fourth', (err, res) => {
    t.error(err)
    t.equal(res.payload, '4')
  })
})

test('prefix is prepended to all the routes inside a sub-app', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/first', (req, res) => {
    res.send('1')
  })

  app.use('/v1', function(subApp) {
    subApp.get('/first', (req, res) => {
      res.send('2')
    })

    subApp.get('/second', (req, res) => {
      res.send('3')
    })

    subApp.use('/user', function(subApp2) {
      subApp2.get('/first', (req, res) => {
        res.send('4')
      })
    })
  })

  app.inject('/first', (err, res) => {
    t.error(err)
    t.equal(res.payload, '1')
  })

  app.inject('/v1/first', (err, res) => {
    t.error(err)
    t.equal(res.payload, '2')
  })

  app.inject('/v1/second', (err, res) => {
    t.error(err)
    t.equal(res.payload, '3')
  })

  app.inject('/v1/user/first', (err, res) => {
    t.error(err)
    t.equal(res.payload, '4')
  })
})

test('Prefix with trailing /', (t) => {
  t.plan(8)

  const app = medley()

  app.use('/v1/', function(subApp) {

    subApp.get('/route1', (req, res) => {
      res.send('1')
    })

    subApp.get('route2', (req, res) => {
      res.send('2')
    })

    subApp.use('/empty/', function(subApp2) {
      subApp2.get('', (req, res) => {
        res.send('3')
      })
    })

    subApp.use('/slash/', function(subApp2) {
      subApp2.get('/', (req, res) => {
        res.send('4')
      })
    })

  })

  app.inject('/v1/route1', (err, res) => {
    t.error(err)
    t.equal(res.payload, '1')
  })

  app.inject('/v1/route2', (err, res) => {
    t.error(err)
    t.equal(res.payload, '2')
  })

  app.inject('/v1/empty/', (err, res) => {
    t.error(err)
    t.equal(res.payload, '3')
  })

  app.inject('/v1/slash/', (err, res) => {
    t.error(err)
    t.equal(res.payload, '4')
  })
})

test('prefix works many levels deep', (t) => {
  t.plan(2)

  const app = medley()

  app.use('/v1', function(subApp) {

    subApp.use('/v2', function(subApp2) {

      subApp2.use(function(subApp3) { // No prefix on this level

        subApp3.use('/v3', function(subApp4) {

          subApp4.get('/', (req, res) => {
            res.send('payload')
          })

        })

      })

    })

  })

  app.inject('/v1/v2/v3', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'payload')
  })
})

test('prefix should support parameters', (t) => {
  t.plan(2)
  const app = medley()

  app.use('/v1/:id', function(subApp) {
    subApp.get('/hello', (req, res) => {
      res.send(req.params.id)
    })
  })

  app.inject('/v1/param/hello', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'param')
  })
})

test('app.basePath gets the route prefix', (t) => {
  t.plan(3)

  const app = medley()

  t.equal(app.basePath, '/')

  app.use('/v1', (subApp) => {
    t.equal(subApp.basePath, '/v1')

    subApp.use('/v2', (subApp2) => {
      t.equal(subApp2.basePath, '/v1/v2')
    })
  })
})
