'use strict'

const t = require('tap')
const test = t.test

const medley = require('..')
const sget = require('simple-get').concat
const statusCodes = require('http').STATUS_CODES

const NotFound = require('http-errors').NotFound

const codes = Object.keys(statusCodes)
codes.forEach((code) => {
  code = Number(code)
  if (code >= 400 && code !== 404) helper(code)
})

function helper(code) {
  test('Response error handling - code: ' + code, (t) => {
    t.plan(4)
    const app = medley()
    const err = new Error('winter is coming')

    app.get('/', (req, response) => {
      response.error(code, err)
    })

    app.inject({
      method: 'GET',
      url: '/',
    }, (error, res) => {
      t.error(error)
      t.equal(res.statusCode, code)
      t.equal(res.headers['content-type'], 'application/json')
      t.strictDeepEqual(
        {
          error: statusCodes[code],
          message: err.message,
          statusCode: code,
        },
        JSON.parse(res.payload)
      )
    })
  })
}

test('preHandler hook error handling with external code', (t) => {
  t.plan(3)
  const app = medley()
  const err = new Error('winter is coming')

  app.addHook('preHandler', (req, response, done) => {
    err.status = 400
    done(err)
  })

  app.get('/', () => {})

  app.inject({
    method: 'GET',
    url: '/',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(
      {
        error: statusCodes['400'],
        message: err.message,
        statusCode: 400,
      },
      JSON.parse(res.payload)
    )
  })
})

test('onRequest hook error handling with external done', (t) => {
  t.plan(3)
  const app = medley()
  const err = new Error('winter is coming')

  app.addHook('onRequest', (request, response, done) => {
    err.status = 400
    done(err)
  })

  app.get('/', () => {})

  app.inject({
    method: 'GET',
    url: '/',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(
      {
        error: statusCodes['400'],
        message: err.message,
        statusCode: 400,
      },
      JSON.parse(res.payload)
    )
  })
})

test('Error subApp sets HTTP status code', (t) => {
  t.plan(3)
  const app = medley()
  const err = new Error('winter is coming')
  err.statusCode = 418

  app.get('/', () => {
    return Promise.reject(err)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 418)
    t.deepEqual(
      {
        error: statusCodes['418'],
        message: err.message,
        statusCode: 418,
      },
      JSON.parse(res.payload)
    )
  })
})

test('Error.status property support', (t) => {
  t.plan(3)
  const app = medley()
  const err = new Error('winter is coming')
  err.status = 418

  app.get('/', () => {
    return Promise.reject(err)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 418)
    t.deepEqual(
      {
        error: statusCodes['418'],
        message: err.message,
        statusCode: 418,
      },
      JSON.parse(res.payload)
    )
  })
})

test('Support rejection with values that are not Error instances', (t) => {
  const objs = [
    0,
    '',
    [],
    {},
    null,
    undefined,
    123,
    'abc',
    new RegExp(),
    new Date(),
    new Uint8Array(),
  ]
  t.plan(objs.length)
  for (const nonErr of objs) {
    t.test('Type: ' + typeof nonErr, (t) => {
      t.plan(4)
      const app = medley()

      app.get('/', () => {
        return Promise.reject(nonErr)
      })

      app.setErrorHandler((err, request, response) => {
        if (typeof err === 'object') {
          t.deepEqual(err, nonErr)
        } else {
          t.strictEqual(err, nonErr)
        }
        response.send('error')
      })

      app.inject({
        method: 'GET',
        url: '/',
      }, (error, res) => {
        t.error(error)
        t.strictEqual(res.statusCode, 500)
        t.strictEqual(res.payload, 'error')
      })
    })
  }
})

test('should set the status code from the error object (from route handler)', (t) => {
  t.plan(6)
  const app = medley()

  app.get('/status', (req, response) => {
    const error = new Error('kaboom')
    error.status = 400
    response.error(error)
  })

  app.get('/statusCode', (req, response) => {
    const error = new Error('kaboom')
    error.statusCode = 400
    response.error(error)
  })

  app.inject({
    url: '/status',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Bad Request',
      message: 'kaboom',
      statusCode: 400,
    })
  })

  app.inject({
    url: '/statusCode',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Bad Request',
      message: 'kaboom',
      statusCode: 400,
    })
  })
})

test('should set the status code from the error object (from custom error handler)', (t) => {
  t.plan(5)
  const app = medley()

  app.get('/', (req, response) => {
    const error = new Error('ouch')
    error.statusCode = 401
    response.error(error)
  })

  app.setErrorHandler((err, request, response) => {
    t.is(err.message, 'ouch')
    t.is(response.res.statusCode, 401)
    const error = new Error('kaboom')
    error.statusCode = 400
    response.error(error)
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Bad Request',
      message: 'kaboom',
      statusCode: 400,
    })
  })
})

test('should throw an error if the payload does not get serialized to a valid type', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', (request, response) => {
    response.type('text/html')
    try {
      response.send({})
    } catch (err) {
      t.type(err, TypeError)
      t.strictEqual(err.message, "Attempted to send payload of invalid type 'object'. Expected a string, Buffer, or stream.")
    }
  })

  app.inject('/', () => {
    t.fail('should not be called')
  })
})

test('response.error() throws if called after response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (request, response) => {
    response.send('send')
    try {
      response.error(new Error())
    } catch (err) {
      t.equal(err.message, 'Cannot call response.error() when a response has already been sent')
    }
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'send')
  })
})

test('response.error(err) should work with any err value', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/string', (request, response) => {
    response.error('string')
  })

  app.get('/undefined', (request, response) => {
    response.error()
  })

  app.get('/array', (request, response) => {
    response.error([1, 2])
  })

  app.get('/object', (request, response) => {
    response.error({message: 'object message'})
  })

  app.inject('/string', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  app.inject('/undefined', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  app.inject('/array', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  app.inject('/object', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'object message',
      statusCode: 500,
    })
  })
})

test('response.error(err) should use err.status or err.statusCode', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/501', (request, response) => {
    response.error({status: 501, message: '501'})
  })

  app.get('/502', (request, response) => {
    response.error({status: 502, message: '502'})
  })

  app.inject('/501', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Not Implemented',
      message: '501',
      statusCode: 501,
    })
  })

  app.inject('/502', (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Bad Gateway',
      message: '502',
      statusCode: 502,
    })
  })
})

test('response.error(new NotFound()) should invoke the 404 handler', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/not-found', function(req, response) {
    response.error(new NotFound())
  })

  app.register(function(subApp, options, next) {
    subApp.get('/not-found', function(req, response) {
      response.error(new NotFound())
    })

    subApp.setNotFoundHandler(function(req, response) {
      response.status(404).send('Custom not found response')
    })

    next()
  }, {prefix: '/prefixed'})

  app.listen(0, (err) => {
    t.error(err)

    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.strictEqual(body.toString(), 'Not Found: GET /not-found')
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/prefixed/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.strictEqual(body.toString(), 'Custom not found response')
    })
  })
})

test('response.error(new NotFound()) should send a basic response if called inside a 404 handler', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/not-found', function(req, response) {
    response.error(new NotFound())
  })

  app.setNotFoundHandler(function(req, response) {
    response.error(new NotFound())
  })

  app.listen(0, (err) => {
    t.error(err)

    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/not-found',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
      t.strictEqual(response.headers['content-type'], 'text/plain')
      t.deepEqual(body.toString(), 'Not Found: GET /not-found')
    })
  })
})

test('error with a Content-Type that is not application/json should work', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/text', (request, response) => {
    response.type('text/plain').error(new Error('some application error'))
  })

  app.get('/html', (request, response) => {
    response.type('text/html').error(new Error('some application error'))
  })

  app.inject('/text', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'some application error',
      statusCode: 500,
    })
  })

  app.inject('/html', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.payload), {
      error: 'Internal Server Error',
      message: 'some application error',
      statusCode: 500,
    })
  })
})
