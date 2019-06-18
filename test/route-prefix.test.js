'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

test('route without a prefix', (t) => {
  t.plan(4)

  const app1 = medley()
  app1.get('', (req, res) => {
    res.send('empty string')
  })
  request(app1, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'empty string')
  })

  const app2 = medley()
  app2.get('/', (req, res) => {
    res.send('slash path')
  })
  request(app2, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'slash path')
  })
})

test('prefix joined with "/" route path when strictRouting=false', (t) => {
  t.plan(4)

  const app = medley({strictRouting: false})

  app.createSubApp('/v1')
    .get('/', (req, res) => {
      res.send('payload')
    })

  request(app, '/v1', (err, res) => {
    t.error(err)
    t.equal(res.body, 'payload')
  })

  request(app, '/v1/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'payload')
  })
})

test('prefix joined with "" and "/" route path when strictRouting=true', (t) => {
  t.plan(4)

  const app = medley({strictRouting: true})

  app.createSubApp('/v1')
    .get('', (req, res) => {
      res.send('no slash')
    })
    .get('/', (req, res) => {
      res.send('with slash')
    })

  request(app, '/v1', (err, res) => {
    t.error(err)
    t.equal(res.body, 'no slash')
  })

  request(app, '/v1/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'with slash')
  })
})

test('prefix is "" or "/"', (t) => {
  t.plan(8)

  const app = medley()

  app.createSubApp('/')
    .get('first', (req, res) => {
      res.send('1')
    })
    .get('/second', (req, res) => {
      res.send('2')
    })

  app.createSubApp('')
    .get('third', (req, res) => {
      res.send('3')
    })
    .get('/fourth', (req, res) => {
      res.send('4')
    })

  request(app, '/first', (err, res) => {
    t.error(err)
    t.equal(res.body, '1')
  })

  request(app, '/second', (err, res) => {
    t.error(err)
    t.equal(res.body, '2')
  })

  request(app, '/third', (err, res) => {
    t.error(err)
    t.equal(res.body, '3')
  })

  request(app, '/fourth', (err, res) => {
    t.error(err)
    t.equal(res.body, '4')
  })
})

test('prefix is prepended to all the routes inside a sub-app', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/first', (req, res) => {
    res.send('1')
  })

  const subApp = app.createSubApp('/v1')

  subApp.get('/first', (req, res) => {
    res.send('2')
  })
  subApp.get('/second', (req, res) => {
    res.send('3')
  })

  subApp.createSubApp('/user')
    .get('/first', (req, res) => {
      res.send('4')
    })

  request(app, '/first', (err, res) => {
    t.error(err)
    t.equal(res.body, '1')
  })

  request(app, '/v1/first', (err, res) => {
    t.error(err)
    t.equal(res.body, '2')
  })

  request(app, '/v1/second', (err, res) => {
    t.error(err)
    t.equal(res.body, '3')
  })

  request(app, '/v1/user/first', (err, res) => {
    t.error(err)
    t.equal(res.body, '4')
  })
})

test('Prefix with trailing /', (t) => {
  t.plan(8)

  const app = medley()
  const subApp = app.createSubApp('/v1/')

  subApp.get('/route1', (req, res) => {
    res.send('1')
  })

  subApp.get('route2', (req, res) => {
    res.send('2')
  })

  subApp.createSubApp('/empty/')
    .get('', (req, res) => {
      res.send('3')
    })

  subApp.createSubApp('/slash/')
    .get('/', (req, res) => {
      res.send('4')
    })

  request(app, '/v1/route1', (err, res) => {
    t.error(err)
    t.equal(res.body, '1')
  })

  request(app, '/v1/route2', (err, res) => {
    t.error(err)
    t.equal(res.body, '2')
  })

  request(app, '/v1/empty/', (err, res) => {
    t.error(err)
    t.equal(res.body, '3')
  })

  request(app, '/v1/slash/', (err, res) => {
    t.error(err)
    t.equal(res.body, '4')
  })
})

test('prefix works many levels deep', (t) => {
  t.plan(2)

  const app = medley()

  app.createSubApp('/v1')
    .createSubApp('/v2')
    .createSubApp() // No prefix on this level
    .createSubApp('/v3')
    .get('/', (req, res) => {
      res.send('payload')
    })

  request(app, '/v1/v2/v3', (err, res) => {
    t.error(err)
    t.equal(res.body, 'payload')
  })
})

test('prefix should support parameters', (t) => {
  t.plan(2)
  const app = medley()

  app.createSubApp('/v1/:id')
    .get('/hello', (req, res) => {
      res.send(req.params.id)
    })

  request(app, '/v1/param/hello', (err, res) => {
    t.error(err)
    t.equal(res.body, 'param')
  })
})

test('app.basePath gets the route prefix', (t) => {
  t.plan(3)

  const app = medley()
  t.equal(app.basePath, '/')

  const subApp = app.createSubApp('/v1')
  t.equal(subApp.basePath, '/v1')

  const subApp2 = subApp.createSubApp('/v2')
  t.equal(subApp2.basePath, '/v1/v2')
})
