'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

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

test('async handlers can return the response body', (t) => {
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

test('`res.send()` should throw if called after an async handler returns a value', (t) => {
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

test('`res.error()` should throw if called after an async handler returns a value', (t) => {
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

test('Errors thrown inside an async route handler are caught and handled', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', async () => {
    throw new Error('kaboom')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.strictSame(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: 'kaboom',
      statusCode: 500,
    })
  })
})
