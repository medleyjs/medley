'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')
const sget = require('simple-get').concat

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

test('.decorateRequest() should not allow decorating Medley values', (t) => {
  const app = medley()

  t.throws(
    () => app.decorateRequest('stream', null),
    new Error("A decorator called 'stream' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('headers', null),
    new Error("A decorator called 'headers' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('params', null),
    new Error("A decorator called 'params' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('state', null),
    new Error("A decorator called 'state' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('body', null),
    new Error("A decorator called 'body' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('_query', null),
    new Error("A decorator called '_query' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('query', null),
    new Error("A decorator called 'query' has been already added to Request")
  )

  t.throws(
    () => app.decorateRequest('_trustProxy', null),
    new Error("A decorator called '_trustProxy' has been already added to Request")
  )

  t.end()
})

test('.decorateResponse() should not allow decorating Medley values', (t) => {
  const app = medley()

  t.throws(
    () => app.decorateResponse('stream', null),
    new Error("A decorator called 'stream' has been already added to Response")
  )

  t.throws(
    () => app.decorateResponse('request', null),
    new Error("A decorator called 'request' has been already added to Response")
  )

  t.throws(
    () => app.decorateResponse('route', null),
    new Error("A decorator called 'route' has been already added to Response")
  )

  t.throws(
    () => app.decorateResponse('sent', null),
    new Error("A decorator called 'sent' has been already added to Response")
  )

  t.throws(
    () => app.decorateResponse('_ranCustomError', null),
    new Error("A decorator called '_ranCustomError' has been already added to Response")
  )

  t.throws(
    () => app.decorateResponse('_ranOnSendHooks', null),
    new Error("A decorator called '_ranOnSendHooks' has been already added to Response")
  )

  t.end()
})

test('app decorators are encapsulated in sub-apps', (t) => {
  t.plan(2)
  const app = medley()

  app.use((subApp) => {
    subApp.decorate('test', () => {})
    t.ok(subApp.test)
  })

  app.load(() => {
    t.notOk(app.test)
  })
})

test('cannot decorate sub-app if parent app already has the decorator', (t) => {
  t.plan(1)

  const app = medley()

  app.decorate('foo', true)

  app.use((subApp) => {
    t.throws(
      () => subApp.decorate('foo', 'other'),
      new Error("A decorator called 'foo' has been already added")
    )
  })
})

test('decorateRequest inside a sub-app', (t) => {
  t.plan(9)
  const app = medley()

  app.use((subApp) => {
    subApp.decorateRequest('test', 'test')

    subApp.get('/sub', (req, res) => {
      t.equal(req.test, 'test')
      res.send()
    })
  })

  app.get('/top', (req, res) => {
    t.equal(req.test, 'test')
    res.send()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/sub',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/top',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })
  })
})

test('decorateResponse inside a sub-app', (t) => {
  t.plan(9)
  const app = medley()

  app.use((subApp) => {
    subApp.decorateResponse('test', 'test')

    subApp.get('/sub', (req, res) => {
      t.equal(res.test, 'test')
      res.send()
    })
  })

  app.get('/top', (req, res) => {
    t.equal(res.test, 'test')
    res.send()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/sub',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/top',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })
  })
})

test('decorators should be app-independant', (t) => {
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
