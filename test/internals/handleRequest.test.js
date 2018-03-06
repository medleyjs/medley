'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat

test('request should be defined in onSend Hook on post request with content type application/json', (t) => {
  t.plan(7)
  const app = require('../..')()

  app.addHook('onSend', (request, reply, next) => {
    t.ok(request)
    t.ok(request.req)
    t.ok(request.params)
    t.ok(request.query)
    next()
  })
  app.post('/', (request, reply) => {
    reply.send(200)
  })
  app.listen(0, (err) => {
    app.server.unref()
    t.error(err)
    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'content-type': 'application/json',
      },
    }, (err, response) => {
      t.error(err)
      // a 400 error is expected because of no body
      t.strictEqual(response.statusCode, 400)
    })
  })
})

test('request should be defined in onSend Hook on post request with content type application/x-www-form-urlencoded', (t) => {
  t.plan(7)
  const app = require('../..')()

  app.addHook('onSend', (request, reply, next) => {
    t.ok(request)
    t.ok(request.req)
    t.ok(request.params)
    t.ok(request.query)
    next()
  })
  app.post('/', (request, reply) => {
    reply.send(200)
  })
  app.listen(0, (err) => {
    app.server.unref()
    t.error(err)
    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    }, (err, response) => {
      t.error(err)
      // a 415 error is expected because of missing body parser
      t.strictEqual(response.statusCode, 415)
    })
  })
})

test('request should be defined in onSend Hook on options request with content type application/x-www-form-urlencoded', (t) => {
  t.plan(7)
  const app = require('../..')()

  app.addHook('onSend', (request, reply, next) => {
    t.ok(request)
    t.ok(request.req)
    t.ok(request.params)
    t.ok(request.query)
    next()
  })
  app.options('/', (request, reply) => {
    reply.send(200)
  })
  app.listen(0, (err) => {
    app.server.unref()
    t.error(err)
    sget({
      method: 'OPTIONS',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    }, (err, response) => {
      t.error(err)
      // a 415 error is expected because of missing body parser
      t.strictEqual(response.statusCode, 415)
    })
  })
})
