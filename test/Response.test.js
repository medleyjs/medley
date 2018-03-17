'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

const Response = require('../lib/Response').buildResponse()

test('Response properties', (t) => {
  const res = {headersSent: false, statusCode: 200}
  const request = {}
  const config = {}
  const routeContext = {config}

  const response = new Response(res, request, routeContext)
  t.type(response, Response)
  t.equal(response.stream, res)
  t.equal(response.request, request)
  t.equal(response.route, routeContext)
  t.equal(response.route.config, config)
  t.equal(response.sent, false)
  t.equal(response.headersSent, false)
  t.equal(response.statusCode, 200)
  t.end()
})

test('Response aliases', (t) => {
  const response = new Response()
  t.equal(response.appendHeader, response.append)
  t.equal(response.getHeader, response.get)
  t.equal(response.removeHeader, response.remove)
  t.equal(response.setHeader, response.set)
  t.end()
})

test('res.headersSent is a getter for res.stream.headersSent', (t) => {
  const res = new Response({headersSent: false})
  t.equal(res.headersSent, false)

  res.stream.headersSent = true
  t.equal(res.headersSent, true)

  try {
    res.headersSent = false
    t.fail('should not be able to change res.headersSent')
  } catch (err) {
    t.type(err, Error)
    t.match(err.message, 'Cannot set property headersSent')
  }

  t.end()
})

test('res.statusCode emulates res.statusCode', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.statusCode, 200)

    response.statusCode = 300
    t.equal(response.statusCode, 300)

    response.statusCode = 204
    response.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 204)
  })
})

test('res.status() should set the status code', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, response) => {
    t.equal(response.statusCode, 200)

    response.status(300)
    t.equal(response.statusCode, 300)

    response.status(204).send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 204)
  })
})

test('res.append() sets headers and adds to existing headers', (t) => {
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

test('res.append() does not allow setting a header value to `undefined`', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (req, res) => {
    try {
      res.append('set-cookie', undefined)
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, 'The "value" argument must be specified')
    }

    res.append('x-custom-header', ['a value'])
    try {
      res.append('x-custom-header', undefined)
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, 'The "value" argument must be specified')
    }

    res.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('set-cookie'), false)
    t.deepEqual(res.headers['x-custom-header'], ['a value'])
  })
})

test('res.get/set() get and set the response headers', (t) => {
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

test('res.set() accepts an object of headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (request, response) => {
    response.set({
      'X-Custom-Header1': 'custom header1',
      'x-custom-header2': 'custom header2',
    })
    t.equal(response.get('x-custom-header1'), 'custom header1')
    t.equal(response.get('x-custom-header2'), 'custom header2')

    t.equal(response.set({}), response)

    response.set({'content-type': 'custom/type'}).send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header1'], 'custom header1')
    t.equal(res.headers['x-custom-header2'], 'custom header2')
    t.equal(res.headers['content-type'], 'custom/type')
  })
})

test('res.set() does not allow setting a header value to `undefined`', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/', (req, res) => {
    try {
      res.set('content-type', undefined)
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, 'The "value" argument must be specified')
    }

    try {
      res.set({
        'x-custom-header1': 'string',
        'x-custom-header2': undefined,
      })
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, 'The "value" argument must be specified')
    }

    res.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('content-type'), false)
    t.equal(res.headers['x-custom-header1'], 'string')
    t.equal(res.headers.hasOwnProperty('x-custom-header2'), false)
  })
})

test('res.remove() removes response headers', (t) => {
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
