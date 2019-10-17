'use strict'

const t = require('tap')
const medley = require('../..')
const request = require('../utils/request')

t.test('Default OPTIONS response', (t) => {
  t.plan(12)

  const app = medley()

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.put('/put', (req, res) => {
    res.send({hello: 'world'})
  })

  app.route({
    method: ['DELETE', 'GET', 'HEAD', 'POST'],
    path: '/multi',
    handler() {
      t.fail('handler should not be called')
    },
  })

  request(app, {
    method: 'OPTIONS',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.allow, 'GET,HEAD')
    t.equal(res.body, 'GET,HEAD')
  })

  request(app, {
    method: 'OPTIONS',
    url: '/put',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.allow, 'PUT')
    t.equal(res.body, 'PUT')
  })

  request(app, {
    method: 'OPTIONS',
    url: '/multi',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.allow, 'DELETE,GET,HEAD,POST')
    t.equal(res.body, 'DELETE,GET,HEAD,POST')
  })
})

t.test('Hooks run on default OPTIONS response', (t) => {
  t.plan(20)

  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.deepEqual(req.query, {foo: 'asd'})
    next()
  })

  app.addHook('onFinished', (req, res) => {
    t.deepEqual(req.query, {foo: 'asd'})
    t.equal(res.headersSent, true)
  })

  app.delete('/', (req, res) => {
    res.send('DELETE response')
  })

  app.createSubApp()
    .addHook('onRequest', (req, res, next) => {
      t.deepEqual(req.query, {foo: 'asd'})
      next()
    })
    .addHook('onSend', (req, res, body, next) => {
      t.deepEqual(req.query, {foo: 'asd'})
      next()
    })
    .addHook('onFinished', (req, res) => {
      t.deepEqual(req.query, {foo: 'asd'})
      t.equal(res.headersSent, true)
    })
    .post('/user', (req, res) => {
      res.send('POST response')
    })

  request(app, {
    method: 'OPTIONS',
    url: '/?foo=asd',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.allow, 'DELETE')
    t.equal(res.body, 'DELETE')
  })

  request(app, {
    method: 'OPTIONS',
    url: '/user?foo=asd',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.allow, 'POST')
    t.equal(res.body, 'POST')
  })
})
