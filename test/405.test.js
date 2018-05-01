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
    t.equal(res.headers['content-length'], '28')
    t.equal(res.payload, 'Method Not Allowed: DELETE /')
  })

  app.inject({
    method: 'POST',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.headers['content-length'], '26')
    t.equal(res.payload, 'Method Not Allowed: POST /')
  })
})

t.test('auto 405 response for non-GET/HEAD routes', (t) => {
  t.plan(14)

  const app = medley()

  app.delete('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.route({
    method: ['PUT', 'POST'],
    url: '/user',
    handler(req, res) {
      res.send('hello')
    },
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'DELETE')
    t.equal(res.headers['content-length'], '25')
    t.equal(res.payload, 'Method Not Allowed: GET /')
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

  app.inject('/user', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'POST,PUT')
    t.equal(res.payload, 'Method Not Allowed: GET /user')
  })
})

t.test('hooks run on auto 405 response', (t) => {
  t.plan(18)

  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.addHook('preHandler', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.addHook('onSend', (req, res, payload, next) => {
    t.deepEqual(req.query, {foo: 'bar'})
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.deepEqual(req.query, {foo: 'bar'})
    t.equal(res.headersSent, true)
  })

  app.inject({
    method: 'DELETE',
    url: '/?foo=bar',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.payload, 'Method Not Allowed: DELETE /?foo=bar')
  })

  app.inject({
    method: 'POST',
    url: '/?foo=bar',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 405)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.payload, 'Method Not Allowed: POST /?foo=bar')
  })
})
