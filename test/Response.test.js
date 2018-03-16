'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

const Response = require('../lib/Response').buildResponse()

test('Response properties', (t) => {
  t.plan(5)
  const res = {}
  const request = {}
  const config = {}
  const context = {config}

  const response = new Response(res, request, context)
  t.type(response, Response)
  t.equal(response.res, res)
  t.equal(response.request, request)
  t.equal(response.config, config)
  t.equal(response.sent, false)
})

test('Response aliases', (t) => {
  const response = new Response()
  t.equal(response.appendHeader, response.append)
  t.equal(response.getHeader, response.get)
  t.equal(response.removeHeader, response.remove)
  t.equal(response.setHeader, response.set)
  t.end()
})

test('response.status() should set the status code', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.res.statusCode, 200)

    response.status(300)
    t.equal(response.res.statusCode, 300)

    response.status(204).send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 204)
  })
})

test('response.get/set() get and set the response headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.get('x-custom-header'), undefined)

    t.equal(response.set('x-custom-header', 'custom header'), response)
    t.equal(response.get('x-custom-header'), 'custom header')

    response.set('content-type', 'custom/type')
    response.send('text')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'custom header')
    t.equal(res.headers['content-type'], 'custom/type')
    t.equal(res.payload, 'text')
  })
})

test('response.append() sets headers and adds to existing headers', (t) => {
  t.plan(13)

  const app = medley()

  app.get('/', (request, response) => {
    response.append('x-custom-header', 'first')
    t.equal(response.get('x-custom-header'), 'first')

    t.equal(response.append('x-custom-header', 'second'), response)
    t.deepEqual(response.get('x-custom-header'), ['first', 'second'])

    t.equal(response.append('x-custom-header', ['3', '4']), response)
    t.deepEqual(response.get('x-custom-header'), ['first', 'second', '3', '4'])

    response.send()
  })

  app.get('/append-multiple-to-string', (request, response) => {
    response.append('x-custom-header', 'first')
    t.equal(response.get('x-custom-header'), 'first')

    response.append('x-custom-header', ['second', 'third'])
    t.deepEqual(response.get('x-custom-header'), ['first', 'second', 'third'])

    response.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(res.headers['x-custom-header'], ['first', 'second', '3', '4'])
  })

  app.inject('/append-multiple-to-string', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(res.headers['x-custom-header'], ['first', 'second', 'third'])
  })
})

test('response.remove() removes response headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    response.set('x-custom-header', 'custom header')
    t.equal(response.get('x-custom-header'), 'custom header')

    t.equal(response.remove('x-custom-header'), response)
    t.equal(response.get('x-custom-header'), undefined)

    response
      .set('x-custom-header-2', ['a', 'b'])
      .remove('x-custom-header-2')

    t.equal(response.get('x-custom-header-2'), undefined)

    response.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.notOk('x-custom-header' in res.headers)
    t.notOk('x-custom-header-2' in res.headers)
  })
})
