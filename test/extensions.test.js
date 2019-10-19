'use strict'

const {test} = require('tap')
const medley = require('..')
const request = require('./utils/request')

test('.extend() should be chainable', (t) => {
  const app = medley()
    .extend('a', 'aVal')
    .extend('b', 'bVal')

  t.equal(app.a, 'aVal')
  t.equal(app.b, 'bVal')

  t.end()
})

test('.extendRequest() should be chainable', (t) => {
  medley()
    .extendRequest('a', 'aVal')
    .extendRequest('b', 'bVal')

  t.end()
})

test('.extendResponse() should be chainable', (t) => {
  medley()
    .extendResponse('a', 'aVal')
    .extendResponse('b', 'bVal')

  t.end()
})

test('.extend() should throw if the property already exists', (t) => {
  t.plan(1)

  const app = medley()

  app.extend('foo', 'value')

  t.throws(
    () => app.extend('foo', 'value'),
    new Error("A 'foo' property already exists on the app")
  )
})

test('.extendRequest() should throw if the property already exists', (t) => {
  t.plan(1)

  const app = medley()

  app.extendRequest('foo', 'value')

  t.throws(
    () => app.extendRequest('foo', 'value'),
    new Error("A 'foo' property already exists on the Request object")
  )
})

test('.extendResponse() should throw if the property already exists', (t) => {
  t.plan(1)

  const app = medley()

  app.extendResponse('foo', 'value')

  t.throws(
    () => app.extendResponse('foo', 'value'),
    new Error("A 'foo' property already exists on the Response object")
  )
})

test('.extendRequest() should not allow overwriting Medley values', (t) => {
  const app = medley()

  t.throws(
    () => app.extendRequest('stream', null),
    new Error("A 'stream' property already exists on the Request object")
  )

  t.throws(
    () => app.extendRequest('headers', null),
    new Error("A 'headers' property already exists on the Request object")
  )

  t.throws(
    () => app.extendRequest('params', null),
    new Error("A 'params' property already exists on the Request object")
  )

  t.throws(
    () => app.extendRequest('body', null),
    new Error("A 'body' property already exists on the Request object")
  )

  t.throws(
    () => app.extendRequest('query', null),
    new Error("A 'query' property already exists on the Request object")
  )

  t.end()
})

test('.extendResponse() should not allow overwriting Medley values', (t) => {
  const app = medley()

  t.throws(
    () => app.extendResponse('stream', null),
    new Error("A 'stream' property already exists on the Response object")
  )

  t.throws(
    () => app.extendResponse('request', null),
    new Error("A 'request' property already exists on the Response object")
  )

  t.throws(
    () => app.extendResponse('sent', null),
    new Error("A 'sent' property already exists on the Response object")
  )

  t.throws(
    () => app.extendResponse('headers', null),
    new Error("A 'headers' property already exists on the Response object")
  )

  t.throws(
    () => app.extendResponse('state', null),
    new Error("A 'state' property already exists on the Response object")
  )

  t.throws(
    () => app.extendResponse('_route', null),
    new Error("A '_route' property already exists on the Response object")
  )

  t.end()
})

test('app extensions are encapsulated in sub-apps', (t) => {
  t.plan(2)
  const app = medley()
  const subApp = app.createSubApp()

  subApp.extend('test', 'val')

  t.equal(subApp.test, 'val')
  t.equal(app.test, undefined)
})

test('cannot extend sub-app if parent app already has the property', (t) => {
  t.plan(1)

  const app = medley()

  app.extend('foo', true)

  const subApp = app.createSubApp()

  t.throws(
    () => subApp.extend('foo', 'other'),
    new Error("A 'foo' property already exists on the app")
  )
})

test('extendRequest inside a sub-app', (t) => {
  t.plan(8)
  const app = medley()

  app.createSubApp()
    .extendRequest('test', 'test')
    .get('/sub', (req, res) => {
      t.equal(req.test, 'test')
      res.send()
    })

  app.get('/top', (req, res) => {
    t.equal(req.test, 'test')
    res.send()
  })

  request(app, '/sub', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
  })

  request(app, '/top', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
  })
})

test('extendResponse inside a sub-app', (t) => {
  t.plan(8)
  const app = medley()

  app.createSubApp()
    .extendResponse('test', 'test')
    .get('/sub', (req, res) => {
      t.equal(res.test, 'test')
      res.send()
    })

  app.get('/top', (req, res) => {
    t.equal(res.test, 'test')
    res.send()
  })

  request(app, '/sub', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
  })

  request(app, '/top', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
  })
})

test('`this` inside an added function property refers to the extended object', (t) => {
  t.plan(5)

  const app = medley()

  function returnThis() {
    return this
  }

  app.extend('returnThis', returnThis)
  app.extendRequest('returnThis', returnThis)
  app.extendResponse('returnThis', returnThis)

  t.equal(app.returnThis(), app)

  const subApp = app.createSubApp()
  t.equal(subApp.returnThis(), subApp)

  app.get('/', (req, res) => {
    t.equal(req.returnThis(), req)
    t.equal(res.returnThis(), res)
    res.send()
  })

  request(app, '/', (err) => {
    t.error(err)
  })
})

test('extensions should be app-independent', (t) => {
  const app1 = medley()
  const app2 = medley()

  app1.extend('test', 'foo')
  app2.extend('test', 'foo')

  app1.extendRequest('test', 'foo')
  app2.extendRequest('test', 'foo')

  app1.extendResponse('test', 'foo')
  app2.extendResponse('test', 'foo')

  t.end()
})
