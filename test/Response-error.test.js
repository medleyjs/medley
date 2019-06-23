'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')
const statusCodes = require('http').STATUS_CODES

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

    app.get('/', (req, res) => {
      res.error(code, err)
    })

    request(app, '/', (error, res) => {
      t.error(error)
      t.equal(res.statusCode, code)
      t.equal(res.headers['content-type'], 'application/json')
      t.strictDeepEqual(JSON.parse(res.body), {
        error: statusCodes[code],
        message: err.message,
        statusCode: code,
      })
    })
  })
}

test('onRequest hook error handling with external done', (t) => {
  t.plan(3)
  const app = medley()
  const err = new Error('winter is coming')

  app.addHook('onRequest', (req, res, done) => {
    err.status = 400
    done(err)
  })

  app.get('/', () => {})

  request(app, '/', (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 400)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: statusCodes['400'],
      message: err.message,
      statusCode: 400,
    })
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

  request(app, '/', (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 418)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: statusCodes['418'],
      message: err.message,
      statusCode: 418,
    })
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

  request(app, '/', (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 418)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: statusCodes['418'],
      message: err.message,
      statusCode: 418,
    })
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

      app.setErrorHandler((err, req, res) => {
        if (typeof err === 'object') {
          t.deepEqual(err, nonErr)
        } else {
          t.strictEqual(err, nonErr)
        }
        res.send('error')
      })

      request(app, '/', (error, res) => {
        t.error(error)
        t.strictEqual(res.statusCode, 500)
        t.strictEqual(res.body, 'error')
      })
    })
  }
})

test('should set the status code from the error object (from route handler)', (t) => {
  t.plan(6)
  const app = medley()

  app.get('/status', (req, res) => {
    const error = new Error('kaboom')
    error.status = 400
    res.error(error)
  })

  app.get('/statusCode', (req, res) => {
    const error = new Error('kaboom')
    error.statusCode = 400
    res.error(error)
  })

  request(app, '/status', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(JSON.parse(res.body), {
      error: 'Bad Request',
      message: 'kaboom',
      statusCode: 400,
    })
  })

  request(app, '/statusCode', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(JSON.parse(res.body), {
      error: 'Bad Request',
      message: 'kaboom',
      statusCode: 400,
    })
  })
})

test('should set the status code from the error object (from custom error handler)', (t) => {
  t.plan(5)
  const app = medley()

  app.get('/', (req, res) => {
    const error = new Error('ouch')
    error.statusCode = 401
    res.error(error)
  })

  app.setErrorHandler((err, req, res) => {
    t.is(err.message, 'ouch')
    t.is(res.statusCode, 401)
    const error = new Error('kaboom')
    error.statusCode = 400
    res.error(error)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.deepEqual(JSON.parse(res.body), {
      error: 'Bad Request',
      message: 'kaboom',
      statusCode: 400,
    })
  })
})

test('res.error() throws if called after response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('send')
    try {
      res.error(new Error())
    } catch (err) {
      t.equal(err.message, 'Cannot call .error() when a response has already been sent')
    }
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'send')
  })
})

test('res.error(err) should work with any err value', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/string', (req, res) => {
    res.error('string')
  })

  app.get('/undefined', (req, res) => {
    res.error()
  })

  app.get('/array', (req, res) => {
    res.error([1, 2])
  })

  app.get('/object', (req, res) => {
    res.error({message: 'object message'})
  })

  request(app, '/string', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  request(app, '/undefined', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  request(app, '/array', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: '',
      statusCode: 500,
    })
  })

  request(app, '/object', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'object message',
      statusCode: 500,
    })
  })
})

test('res.error(err) should use err.status or err.statusCode', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/501', (req, res) => {
    res.error({status: 501, message: '501'})
  })

  app.get('/502', (req, res) => {
    res.error({status: 502, message: '502'})
  })

  request(app, '/501', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Not Implemented',
      message: '501',
      statusCode: 501,
    })
  })

  request(app, '/502', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Bad Gateway',
      message: '502',
      statusCode: 502,
    })
  })
})

test('error with a Content-Type that is not application/json should work', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/text', (req, res) => {
    res.type('text/plain').error(new Error('some application error'))
  })

  app.get('/html', (req, res) => {
    res.type('text/html').error(new Error('some application error'))
  })

  request(app, '/text', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'some application error',
      statusCode: 500,
    })
  })

  request(app, '/html', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'some application error',
      statusCode: 500,
    })
  })
})
