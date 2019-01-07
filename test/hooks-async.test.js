/* eslint-disable require-await */
'use strict'

const t = require('tap')
const sget = require('simple-get').concat
const sleep = require('then-sleep')
const medley = require('..')

const {test} = t

test('async hooks', (t) => {
  t.plan(19)

  const app = medley()
  app.addHook('onRequest', async (request, response) => {
    await sleep(1)
    request.onRequestVal = 'the request is coming'
    response.onRequestVal = 'the response has come'
    if (request.method === 'DELETE') {
      throw new Error('some error')
    }
  })

  app.addHook('preHandler', async (request, response) => {
    await sleep(1)
    request.preHandlerVal = 'the request is coming'
    response.preHandlerVal = 'the response has come'
    if (request.method === 'HEAD') {
      throw new Error('some error')
    }
  })

  app.addHook('onSend', async (req, res, payload) => {
    await sleep(1)
    if (req.method === 'DELETE' || req.method === 'HEAD') {
      t.match(payload, 'Internal Server Error')
    } else {
      t.equal(payload, '{"hello":"world"}')
    }
  })

  app.addHook('onFinished', async function() {
    await sleep(1)
    t.ok('onFinished called')
  })

  app.get('/', function(request, response) {
    t.is(request.onRequestVal, 'the request is coming')
    t.is(response.onRequestVal, 'the response has come')
    t.is(request.preHandlerVal, 'the request is coming')
    t.is(response.preHandlerVal, 'the response has come')
    response.send({hello: 'world'})
  })

  app.head('/', function(req, response) {
    response.send({hello: 'world'})
  })

  app.delete('/', function(req, response) {
    response.send({hello: 'world'})
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

  app.addHook('onSend', async (req, res, serializedPayload) => {
    t.ok('onSend called')
    t.deepEqual(JSON.parse(serializedPayload), payload)
    return serializedPayload.replace('world', 'modified')
  })

  app.addHook('onSend', async (req, res, serializedPayload) => {
    t.ok('onSend called')
    t.deepEqual(JSON.parse(serializedPayload), modifiedPayload)
    return anotherPayload
  })

  app.addHook('onSend', async (req, res, serializedPayload) => {
    t.ok('onSend called')
    t.strictEqual(serializedPayload, anotherPayload)
  })

  app.get('/', (req, response) => {
    response.send(payload)
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
  t.plan(5)
  const app = medley()

  app.addHook('onRequest', async (request, response) => {
    response.send('hello')
  })

  app.addHook('onRequest', async () => {
    t.fail('this should not be called')
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async (req, res, payload) => {
    t.equal(payload, 'hello')
  })

  app.addHook('onFinished', async () => {
    t.ok('called')
  })

  app.get('/', () => {
    t.fail('this should not be called')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('preHandler hooks should be able to send a response', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('preHandler', async (req, response) => {
    response.send('hello')
  })

  app.addHook('preHandler', async () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', async (req, res, payload) => {
    t.equal(payload, 'hello')
  })

  app.addHook('onFinished', async () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})
