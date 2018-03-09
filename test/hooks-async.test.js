/* eslint-disable require-await */
'use strict'

const t = require('tap')
const sget = require('simple-get').concat
const sleep = require('then-sleep')
const medley = require('..')
const fs = require('fs')

const {test} = t

test('async hooks', (t) => {
  t.plan(19)

  const app = medley()
  app.addHook('onRequest', async (req, res, next) => {
    await sleep(1)
    req.testVal = 'the request is coming'
    res.testVal = 'the reply has come'
    if (req.method === 'DELETE') {
      throw new Error('some error')
    }
    next()
  })

  app.addHook('preHandler', async (request, reply, next) => {
    await sleep(1)
    request.test = 'the request is coming'
    reply.test = 'the reply has come'
    if (request.req.method === 'HEAD') {
      throw new Error('some error')
    }
    next()
  })

  app.addHook('onSend', async (request, reply, next) => {
    await sleep(1)
    t.ok('onSend called')
    next()
  })

  app.addHook('onResponse', async function() {
    await sleep(1)
    t.ok('onResponse called')
  })

  app.get('/', function(request, reply) {
    t.is(request.req.testVal, 'the request is coming')
    t.is(reply.res.testVal, 'the reply has come')
    t.is(request.test, 'the request is coming')
    t.is(reply.test, 'the reply has come')
    reply.send({hello: 'world'})
  })

  app.head('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.delete('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'HEAD',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })

    sget({
      method: 'DELETE',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('onSend hooks can modify payload', (t) => {
  t.plan(10)
  const app = medley()
  const payload = {hello: 'world'}
  const modifiedPayload = {hello: 'modified'}
  const anotherPayload = '"winter is coming"'

  app.addHook('onSend', async (request, reply, next) => {
    t.ok('onSend called')
    t.deepEqual(JSON.parse(reply.payload), payload)
    reply.payload = reply.payload.replace('world', 'modified')
    next()
  })

  app.addHook('onSend', async (request, reply, next) => {
    t.ok('onSend called')
    t.deepEqual(JSON.parse(reply.payload), modifiedPayload)
    reply.payload = anotherPayload
    next()
  })

  app.addHook('onSend', async (request, reply, next) => {
    t.ok('onSend called')
    t.strictEqual(reply.payload, anotherPayload)
    next()
  })

  app.get('/', (req, reply) => {
    reply.send(payload)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.payload, anotherPayload)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '18')
  })
})

test('onRequest hooks should be able to send a response', (t) => {
  t.plan(4)
  const app = medley()

  app.addHook('onRequest', async (req, res) => {
    res.end('hello')
  })

  app.addHook('onRequest', async () => {
    t.fail('this should not be called')
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onResponse', async () => {
    t.ok('called')
  })

  app.get('/', () => {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('onRequest hooks should be able to send a response (last hook)', (t) => {
  t.plan(4)
  const app = medley()

  app.addHook('onRequest', async (req, res) => {
    res.end('hello')
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onResponse', async () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('preHandler hooks should be able to send a response', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('preHandler', async (req, reply) => {
    reply.send('hello')
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async (request, reply, next) => {
    t.equal(reply.payload, 'hello')
    next()
  })

  app.addHook('onResponse', async () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('preHandler hooks should be able to send a response (last hook)', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('preHandler', async (req, reply) => {
    reply.send('hello')
  })

  app.addHook('onSend', async (request, reply, next) => {
    t.equal(reply.payload, 'hello')
    next()
  })

  app.addHook('onResponse', async () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('onRequest respond with a stream', (t) => {
  t.plan(3)
  const app = medley()

  app.addHook('onRequest', async (req, res) => {
    const stream = fs.createReadStream(__filename, 'utf8')
    stream.pipe(res)
    res.once('error', err => t.fail(err))
  })

  app.addHook('onRequest', async () => {
    t.fail('this should not be called')
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onResponse', async () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
  })
})

test('preHandler respond with a stream', (t) => {
  t.plan(7)
  const app = medley()

  app.addHook('onRequest', async (req, res, next) => {
    t.ok('called')
    next()
  })

  // we are calling `reply.send` inside the `preHandler` hook with a stream,
  // this triggers the `onSend` hook event if `preHandler` has not yet finished
  const order = [1, 2]

  app.addHook('preHandler', async (request, reply) => {
    const stream = fs.createReadStream(__filename, 'utf8')
    reply.send(stream)
    reply.res.once('error', err => t.fail(err))
    reply.res.once('finish', () => {
      t.is(order.shift(), 2)
    })
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async (request, reply, next) => {
    t.is(order.shift(), 1)
    t.is(typeof reply.payload.pipe, 'function')
    next()
  })

  app.addHook('onResponse', async () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
  })
})

