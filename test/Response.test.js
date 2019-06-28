'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

const Response = require('../lib/Response').buildResponse()

test('Response properties', (t) => {
  const res = {headersSent: false, statusCode: 200}
  const req = {}
  const config = {}
  const routeContext = {config}

  const response = new Response(res, req, routeContext)
  t.type(response, Response)
  t.equal(response.stream, res)
  t.equal(response.request, req)
  t.equal(response.route, routeContext)
  t.equal(response.route.config, config)
  t.equal(response.sent, false)
  t.type(response.state, 'object')
  t.equal(response.headersSent, false)
  t.equal(response.statusCode, 200)

  t.end()
})

test('Response aliases', (t) => {
  const response = new Response()
  t.equal(response.append, response.appendHeader)
  t.equal(response.get, response.getHeader)
  t.equal(response.has, response.hasHeader)
  t.equal(response.remove, response.removeHeader)
  t.equal(response.set, response.setHeader)
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

  app.get('/', (req, res) => {
    t.equal(res.statusCode, 200)

    res.statusCode = 300
    t.equal(res.statusCode, 300)

    res.statusCode = 204
    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 204)
  })
})

test('res.status() should set the status code', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    t.equal(res.statusCode, 200)

    res.status(300)
    t.equal(res.statusCode, 300)

    res.status(204).send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 204)
  })
})

test('res.appendHeader() sets headers and adds to existing headers', (t) => {
  t.plan(18)

  const app = medley()

  app.get('/', (req, res) => {
    res.appendHeader('x-custom-header', 'first')
    t.equal(res.getHeader('x-custom-header'), 'first')

    t.equal(res.appendHeader('x-custom-header', 'second'), res)
    t.deepEqual(res.getHeader('x-custom-header'), ['first', 'second'])

    t.equal(res.appendHeader('x-custom-header', ['3', '4']), res)
    t.deepEqual(res.getHeader('x-custom-header'), ['first', 'second', '3', '4'])

    res.send()
  })

  app.get('/append-multiple-to-string', (req, res) => {
    res.appendHeader('x-custom-header', 'first')
    t.equal(res.getHeader('x-custom-header'), 'first')

    res.appendHeader('x-custom-header', ['second', 'third'])
    t.deepEqual(res.getHeader('x-custom-header'), ['first', 'second', 'third'])

    res.send()
  })

  app.get('/append-case-insensitive', (req, res) => {
    res.appendHeader('X-Custom-Header', 'first')
    t.equal(res.getHeader('x-custom-header'), 'first')

    res.appendHeader('X-Custom-Header', ['second', 'third'])
    t.deepEqual(res.getHeader('x-custom-header'), ['first', 'second', 'third'])

    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'first, second, 3, 4')
  })

  request(app, '/append-multiple-to-string', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'first, second, third')
  })

  request(app, '/append-case-insensitive', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'first, second, third')
  })
})

test('res.appendHeader() does not allow setting a header value to `undefined`', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (req, res) => {
    try {
      res.appendHeader('set-cookie', undefined)
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, "Cannot set header value to 'undefined'")
    }

    res.appendHeader('x-custom-header', ['a value'])
    try {
      res.appendHeader('x-custom-header', undefined)
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, "Cannot set header value to 'undefined'")
    }

    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('set-cookie'), false)
    t.equal(res.headers['x-custom-header'], 'a value')
  })
})

test('res.getHeader/setHeader() get and set the response headers', (t) => {
  t.plan(16)

  const app = medley()

  app.get('/', (req, res) => {
    t.equal(res.getHeader('x-custom-header'), undefined)

    t.equal(res.setHeader('x-custom-header', 'custom header'), res)
    t.equal(res.getHeader('x-custom-header'), 'custom header')

    res.setHeader('content-type', 'custom/type')
    res.send('text')
  })

  app.get('/case-insensitive', (req, res) => {
    t.equal(res.getHeader('X-Custom-Header'), undefined)

    res.setHeader('X-Custom-Header', 'custom header')
    t.equal(res.getHeader('X-Custom-Header'), 'custom header')
    t.equal(res.getHeader('x-custom-header'), 'custom header')

    res.setHeader('Content-Type', 'custom/type')
    res.send('text')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'custom header')
    t.equal(res.headers['content-type'], 'custom/type')
    t.equal(res.body, 'text')
  })

  request(app, '/case-insensitive', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header'], 'custom header')
    t.equal(res.headers['content-type'], 'custom/type')
    t.equal(res.body, 'text')
  })
})

test('res.hasHeader() checks if a response header has been set', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    t.equal(res.hasHeader('x-custom-header'), false)

    res.setHeader('x-custom-header', 'custom header')
    t.equal(res.hasHeader('x-custom-header'), true)
    t.equal(res.hasHeader('X-Custom-Header'), true, 'is case-insensitive')

    t.equal(res.hasHeader('__proto__'), false, 'does not report unset properties that are on Object.prototype')

    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })
})

test('res.setHeader() accepts an object of headers', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', (req, res) => {
    res.setHeader({
      'X-Custom-Header1': 'custom header1',
      'x-custom-header2': 'custom header2',
    })
    t.equal(res.getHeader('x-custom-header1'), 'custom header1')
    t.equal(res.getHeader('x-custom-header2'), 'custom header2')

    t.equal(res.setHeader({}), res)

    res.setHeader({'content-type': 'custom/type'}).send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['x-custom-header1'], 'custom header1')
    t.equal(res.headers['x-custom-header2'], 'custom header2')
    t.equal(res.headers['content-type'], 'custom/type')
  })
})

test('res.setHeader() does not allow setting a header value to `undefined`', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/', (req, res) => {
    try {
      res.setHeader('content-type', undefined)
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, "Cannot set header value to 'undefined'")
    }

    try {
      res.setHeader({
        'x-custom-header1': 'string',
        'x-custom-header2': undefined,
      })
      t.fail('should not allow setting a header to `undefined`')
    } catch (err) {
      t.type(err, TypeError)
      t.equal(err.message, "Cannot set header value to 'undefined'")
    }

    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('content-type'), false)
    t.equal(res.headers['x-custom-header1'], 'string')
    t.equal(res.headers.hasOwnProperty('x-custom-header2'), false)
  })
})

test('res.removeHeader() removes response headers', (t) => {
  t.plan(10)

  const app = medley()

  app.get('/', (req, res) => {
    res.setHeader('x-custom-header', 'custom header')
    t.equal(res.getHeader('x-custom-header'), 'custom header')

    t.equal(res.removeHeader('x-custom-header'), res)
    t.equal(res.getHeader('x-custom-header'), undefined)

    res
      .setHeader('x-custom-header-2', ['a', 'b'])
      .removeHeader('x-custom-header-2')
    t.equal(res.getHeader('x-custom-header-2'), undefined)

    res
      .setHeader('X-Custom-Header-3', 'custom header 3')
      .removeHeader('X-Custom-Header-3')
    t.equal(res.getHeader('X-Custom-Header-3'), undefined)

    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.notOk('x-custom-header' in res.headers)
    t.notOk('x-custom-header-2' in res.headers)
    t.notOk('x-custom-header-3' in res.headers)
  })
})

test('res.state should be different for each res instance', (t) => {
  t.plan(1)
  t.notEqual(new Response().state, new Response().state)
})

test('res.type() does not allow setting a header value to `undefined`', (t) => {
  t.plan(1)

  const res = new Response()

  t.throws(
    () => res.type(undefined),
    new TypeError("Cannot set header value to 'undefined'")
  )
})
