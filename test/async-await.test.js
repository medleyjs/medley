'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')
const statusCodes = require('http').STATUS_CODES

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

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
      t.throws(
        () => res.send(),
        new Error('Cannot call .send() when a response has already been sent')
      )
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
      t.throws(
        () => res.error(),
        new Error('Cannot call .error() when a response has already been sent')
      )
    })
    return 'value'
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'value')
  })
})

test('Allows responding with `res.send()` inside of an async function', (t) => {
  t.plan(2)

  const app = medley()

  app.get('/', async (req, res) => {
    await sleep(1)
    res.send('success')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'success')
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
