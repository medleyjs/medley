/* eslint-disable require-await */
'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const sleep = require('then-sleep')
const medley = require('..')

test('async hooks', (t) => {
  t.plan(12)

  const app = medley()

  app.addHook('onRequest', async (req, res) => {
    await sleep(1)

    req.onRequestVal = 'the request is coming'
    res.onRequestVal = 'the response has come'

    if (req.method === 'DELETE') {
      throw new Error('some error')
    }
  })

  app.addHook('onSend', async (req, res, payload) => {
    await sleep(1)

    if (req.method === 'DELETE') {
      t.match(payload, 'Internal Server Error')
    } else {
      t.equal(payload, '{"hello":"world"}')
    }
  })

  app.addHook('onFinished', async function() {
    await sleep(1)
    t.ok('onFinished called')
  })

  app.get('/', function(req, res) {
    t.equal(req.onRequestVal, 'the request is coming')
    t.equal(res.onRequestVal, 'the response has come')
    res.send({hello: 'world'})
  })

  app.delete('/', function(req, res) {
    res.send({hello: 'world'})
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/', {method: 'DELETE'}, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
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

  app.get('/', (req, res) => {
    res.send(payload)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.body, anotherPayload)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '18')
  })
})

test('onRequest hooks should be able to send a response', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('onRequest', async (req, res) => {
    res.send('hello')
    return false
  })

  app.addHook('onRequest', async () => {
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

  request(app, '/', (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.body, 'hello')
  })
})
