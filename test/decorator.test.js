'use strict'

const {test} = require('tap')
const medley = require('..')
const request = require('./utils/request')

test('.decorate() should be chainable', (t) => {
  const app = medley()
    .decorate('a', 'aVal')
    .decorate('b', 'bVal')

  t.equal(app.a, 'aVal')
  t.equal(app.b, 'bVal')

  t.end()
})

test('.decorateRequest() should be chainable', (t) => {
  medley()
    .decorateRequest('a', 'aVal')
    .decorateRequest('b', 'bVal')

  t.end()
})

test('.decorateResponse() should be chainable', (t) => {
  medley()
    .decorateResponse('a', 'aVal')
    .decorateResponse('b', 'bVal')

  t.end()
})

test('.decorate() should throw on duplicate decorator', (t) => {
  t.plan(1)

  const app = medley()

  app.decorate('foo', 'value')

  t.throws(
    () => app.decorate('foo', 'value'),
    new Error("A decorator called 'foo' has already been added")
  )
})

test('.decorateRequest() should throw on duplicate decorator', (t) => {
  t.plan(1)

  const app = medley()

  app.decorateRequest('foo', 'value')

  t.throws(
    () => app.decorateRequest('foo', 'value'),
    new Error("A decorator called 'foo' has already been added to Request")
  )
})

test('.decorateResponse() should throw on duplicate decorator', (t) => {
  t.plan(1)

  const app = medley()

  app.decorateResponse('foo', 'value')

  t.throws(
    () => app.decorateResponse('foo', 'value'),
    new Error("A decorator called 'foo' has already been added to Response")
  )
})

test('.decorateRequest() should not allow decorating Medley values', (t) => {
  const app = medley()

  t.throws(
    () => app.decorateRequest('stream', null),
    new Error("A decorator called 'stream' has already been added to Request")
  )

  t.throws(
    () => app.decorateRequest('headers', null),
    new Error("A decorator called 'headers' has already been added to Request")
  )

  t.throws(
    () => app.decorateRequest('params', null),
    new Error("A decorator called 'params' has already been added to Request")
  )

  t.throws(
    () => app.decorateRequest('body', null),
    new Error("A decorator called 'body' has already been added to Request")
  )

  t.throws(
    () => app.decorateRequest('query', null),
    new Error("A decorator called 'query' has already been added to Request")
  )

  t.end()
})

test('.decorateResponse() should not allow decorating Medley values', (t) => {
  const app = medley()

  t.throws(
    () => app.decorateResponse('stream', null),
    new Error("A decorator called 'stream' has already been added to Response")
  )

  t.throws(
    () => app.decorateResponse('request', null),
    new Error("A decorator called 'request' has already been added to Response")
  )

  t.throws(
    () => app.decorateResponse('sent', null),
    new Error("A decorator called 'sent' has already been added to Response")
  )

  t.throws(
    () => app.decorateResponse('headers', null),
    new Error("A decorator called 'headers' has already been added to Response")
  )

  t.throws(
    () => app.decorateResponse('state', null),
    new Error("A decorator called 'state' has already been added to Response")
  )

  t.throws(
    () => app.decorateResponse('_route', null),
    new Error("A decorator called '_route' has already been added to Response")
  )

  t.end()
})

test('app decorators are encapsulated in sub-apps', (t) => {
  t.plan(2)
  const app = medley()
  const subApp = app.createSubApp()

  subApp.decorate('test', 'val')

  t.equal(subApp.test, 'val')
  t.equal(app.test, undefined)
})

test('cannot decorate sub-app if parent app already has the decorator', (t) => {
  t.plan(1)

  const app = medley()

  app.decorate('foo', true)

  const subApp = app.createSubApp()

  t.throws(
    () => subApp.decorate('foo', 'other'),
    new Error("A decorator called 'foo' has already been added")
  )
})

test('decorateRequest inside a sub-app', (t) => {
  t.plan(8)
  const app = medley()

  app.createSubApp()
    .decorateRequest('test', 'test')
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

test('decorateResponse inside a sub-app', (t) => {
  t.plan(8)
  const app = medley()

  app.createSubApp()
    .decorateResponse('test', 'test')
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

test('decorators should be app-independent', (t) => {
  const app1 = medley()
  const app2 = medley()

  app1.decorate('test', 'foo')
  app2.decorate('test', 'foo')

  app1.decorateRequest('test', 'foo')
  app2.decorateRequest('test', 'foo')

  app1.decorateResponse('test', 'foo')
  app2.decorateResponse('test', 'foo')

  t.end()
})
