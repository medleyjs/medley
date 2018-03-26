'use strict'

const t = require('tap')
const medley = require('..')

t.test('auto 405 response for unset methods', (t) => {
  t.plan(10)

  const app = medley()

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.inject({
    method: 'DELETE',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.headers['content-length'], '0')
    t.equal(res.payload, '')
  })

  app.inject({
    method: 'POST',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.headers['content-length'], '0')
    t.equal(res.payload, '')
  })
})

t.test('auto 405 response for non-GET/HEAD route', (t) => {
  t.plan(10)

  const app = medley()

  app.delete('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'DELETE')
    t.equal(res.headers['content-length'], '0')
    t.equal(res.payload, '')
  })

  app.inject({
    method: 'HEAD',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'DELETE')
    t.equal(res.headers['content-length'], undefined)
    t.equal(res.payload, '')
  })
})

t.test('hooks run on auto 405 response', (t) => {
  t.plan(18)

  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.addHook('preHandler', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.addHook('onSend', (req, res, payload, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.deepEqual(req.query, {foo: 'asd'})
    t.equal(res.headersSent, true)
  })

  app.inject({
    method: 'DELETE',
    url: '/?foo=asd',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.payload, '')
  })

  app.inject({
    method: 'POST',
    url: '/?foo=asd',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.payload, '')
  })
})
