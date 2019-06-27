'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

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
    t.test(`Type: ${JSON.stringify(nonErr) || nonErr}`, (t) => {
      t.plan(4)

      const app = medley()

      app.get('/', () => {
        return Promise.reject(nonErr)
      })

      app.addHook('onError', (err, req, res) => {
        t.equal(err, nonErr)
        res.status(500).send('error')
      })

      request(app, '/', (error, res) => {
        t.error(error)
        t.strictEqual(res.statusCode, 500)
        t.strictEqual(res.body, 'error')
      })
    })
  }
})

test('res.error() throws if called after response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('send')
    t.throws(
      () => res.error(new Error()),
      new Error('Cannot call .error() when a response has already been sent')
    )
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
