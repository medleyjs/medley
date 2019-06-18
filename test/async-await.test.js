/* eslint-disable require-await */
'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')
const sleep = require('then-sleep')
const statusCodes = require('http').STATUS_CODES

const opts = {
  responseSchema: {
    200: {
      type: 'object',
      properties: {
        hello: {
          type: 'string',
        },
      },
    },
  },
}

test('async await', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/', opts, async function awaitMyFunc() {
    await sleep(200)
    return {hello: 'world'}
  })

  app.get('/no-await', opts, async function() {
    return {hello: 'world'}
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictSame(JSON.parse(res.body), {hello: 'world'})
  })

  request(app, '/no-await', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictSame(JSON.parse(res.body), {hello: 'world'})
  })
})

test('should throw if an async function returns a value and res.send() is also called', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', async (req, res) => {
    setImmediate(() => {
      try {
        res.send()
      } catch (err) {
        t.equal(err.message, 'Cannot call .send() when a response has already been sent')
      }
    })
    return 'value'
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'value')
  })
})

test('should throw if an async function returns a value and res.error() is also called', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', async (req, res) => {
    setImmediate(() => {
      try {
        res.error()
      } catch (err) {
        t.equal(err.message, 'Cannot call .error() when a response has already been sent')
      }
    })
    return 'value'
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'value')
  })
})

test('support response decorators with await', (t) => {
  t.plan(2)

  const app = medley()

  app.decorateResponse('wow', function() {
    setImmediate(() => {
      this.send({hello: 'world'})
    })
  })

  app.get('/', async (req, res) => {
    await sleep(1)
    res.wow()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictSame(JSON.parse(res.body), {hello: 'world'})
  })
})

test('thrown Error in handler sets HTTP status code', (t) => {
  t.plan(3)

  const app = medley()

  const err = new Error('winter is coming')
  err.statusCode = 418

  app.get('/', async () => {
    throw err
  })

  request(app, '/', (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 418)
    t.strictDeepEqual(
      {
        error: statusCodes['418'],
        message: err.message,
        statusCode: 418,
      },
      JSON.parse(res.body)
    )
  })
})

test('customErrorHandler support', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', async () => {
    const error = new Error('ouch')
    error.statusCode = 400
    throw error
  })

  app.setErrorHandler(async (err) => {
    t.is(err.message, 'ouch')
    const error = new Error('kaboom')
    error.statusCode = 401
    throw error
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 401)
    t.strictSame(
      {
        error: statusCodes['401'],
        message: 'kaboom',
        statusCode: 401,
      },
      JSON.parse(res.body)
    )
  })
})
