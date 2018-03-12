'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')
const statusCodes = require('http').STATUS_CODES

const codes = Object.keys(statusCodes)
codes.forEach((code) => {
  if (Number(code) >= 400) helper(code)
})

function helper(code) {
  test('Response error handling - code: ' + code, (t) => {
    t.plan(4)
    const app = medley()
    const err = new Error('winter is coming')

    app.get('/', (req, response) => {
      response
        .code(Number(code))
        .error(err)
    })

    app.inject({
      method: 'GET',
      url: '/',
    }, (error, res) => {
      t.error(error)
      t.strictEqual(res.statusCode, Number(code))
      t.equal(res.headers['content-type'], 'application/json')
      t.deepEqual(
        {
          error: statusCodes[code],
          message: err.message,
          statusCode: Number(code),
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
    response.code(400)
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
    response.code(400)
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

test('Error status code below 400 defaults to 500', (t) => {
  t.plan(3)
  const app = medley()
  const err = new Error('winter is coming')
  err.statusCode = 399

  app.get('/', () => {
    return Promise.reject(err)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 500)
    t.deepEqual(
      {
        error: statusCodes['500'],
        message: err.message,
        statusCode: 500,
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
