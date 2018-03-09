/* eslint-disable require-await */
'use strict'

const t = require('tap')
const sget = require('simple-get').concat
const medley = require('..')
const sleep = require('then-sleep')
const statusCodes = require('http').STATUS_CODES

const test = t.test

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
  t.plan(11)
  const app = medley()
  try {
    app.get('/', opts, async function awaitMyFunc() {
      await sleep(200)
      return {hello: 'world'}
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    app.get('/no-await', opts, async function() {
      return {hello: 'world'}
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no-await',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('should throw if an async function returns a value and reply.send() is also called', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', async (request, reply) => {
    setImmediate(() => {
      try {
        reply.send()
      } catch (err) {
        t.equal(err.message, 'Cannot call reply.send() when a response has already been sent')
      }
    })
    return 'value'
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'value')
  })
})

test('should throw if an async function returns a value and reply.error() is also called', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', async (request, reply) => {
    setImmediate(() => {
      try {
        reply.error()
      } catch (err) {
        t.equal(err.message, 'Cannot call reply.error() when a response has already been sent')
      }
    })
    return 'value'
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'value')
  })
})

test('support reply decorators with await', (t) => {
  t.plan(2)

  const app = medley()

  app.decorateReply('wow', function() {
    setImmediate(() => {
      this.send({hello: 'world'})
    })
  })

  app.get('/', async (req, reply) => {
    await sleep(1)
    reply.wow()
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    const payload = JSON.parse(res.payload)
    t.deepEqual(payload, {hello: 'world'})
  })
})

test('inject async await', async (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', (req, reply) => {
    reply.send({hello: 'world'})
  })

  try {
    const res = await app.inject({method: 'GET', url: '/'})
    t.deepEqual({hello: 'world'}, JSON.parse(res.payload))
  } catch (err) {
    t.fail(err)
  }
})

test('inject async await - when the server is up', async (t) => {
  t.plan(2)

  const app = medley()

  app.get('/', (req, reply) => {
    reply.send({hello: 'world'})
  })

  try {
    const res = await app.inject({method: 'GET', url: '/'})
    t.deepEqual({hello: 'world'}, JSON.parse(res.payload))
  } catch (err) {
    t.fail(err)
  }

  await sleep(200)

  try {
    const res2 = await app.inject({method: 'GET', url: '/'})
    t.deepEqual({hello: 'world'}, JSON.parse(res2.payload))
  } catch (err) {
    t.fail(err)
  }
})

test('async await plugin', async (t) => {
  t.plan(1)

  const app = medley()

  app.register(async (subApp) => {
    subApp.get('/', (req, reply) => {
      reply.send({hello: 'world'})
    })

    await sleep(200)
  })

  try {
    const res = await app.inject({method: 'GET', url: '/'})
    t.deepEqual({hello: 'world'}, JSON.parse(res.payload))
  } catch (err) {
    t.fail(err)
  }
})

test('Thrown Error subApp sets HTTP status code', (t) => {
  t.plan(3)

  const app = medley()

  const err = new Error('winter is coming')
  err.statusCode = 418

  app.get('/', async () => {
    throw err
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

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 401)
    t.deepEqual(
      {
        error: statusCodes['401'],
        message: 'kaboom',
        statusCode: 401,
      },
      JSON.parse(res.payload)
    )
  })
})
