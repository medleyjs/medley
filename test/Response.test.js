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

test('response.getHeader/setHeader() get and set the response headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.getHeader('X-Custom-Header'), undefined)

    t.equal(response.setHeader('X-Custom-Header', 'custom header'), response)
    t.equal(response.getHeader('X-Custom-Header'), 'custom header')

    response.setHeader('Content-Type', 'custom/type')
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

test('response.appendHeader() adds to existing headers', (t) => {
  t.plan(13)

  const app = medley()

  app.get('/', (request, response) => {
    response.appendHeader('X-Custom-Header', 'first')
    t.equal(response.getHeader('X-Custom-Header'), 'first')

    t.equal(response.appendHeader('X-Custom-Header', 'second'), response)
    t.deepEqual(response.getHeader('X-Custom-Header'), ['first', 'second'])

    t.equal(response.appendHeader('X-Custom-Header', ['3', '4']), response)
    t.deepEqual(response.getHeader('X-Custom-Header'), ['first', 'second', '3', '4'])

    response.send()
  })

  app.get('/append-multiple-to-string', (request, response) => {
    response.appendHeader('X-Custom-Header', 'first')
    t.equal(response.getHeader('X-Custom-Header'), 'first')

    response.appendHeader('X-Custom-Header', ['second', 'third'])
    t.deepEqual(response.getHeader('X-Custom-Header'), ['first', 'second', 'third'])

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

test('response.removeHeader() removes response headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    response.setHeader('X-Custom-Header', 'custom header')
    t.equal(response.getHeader('X-Custom-Header'), 'custom header')

    t.equal(response.removeHeader('X-Custom-Header'), response)
    t.equal(response.getHeader('X-Custom-Header'), undefined)

    response
      .setHeader('X-Custom-Header-2', ['a', 'b'])
      .removeHeader('X-Custom-Header-2')

    t.equal(response.getHeader('X-Custom-Header-2'), undefined)

    response.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.notOk('x-custom-header' in res.headers)
    t.notOk('x-custom-header-2' in res.headers)
  })
})
