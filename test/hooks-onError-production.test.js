'use strict'

const t = require('tap')
const request = require('./utils/request')
const medley = require('..')

process.env.NODE_ENV = 'production'

t.test('default onError hook with 5xx status code - production', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/500', (req, res) => {
    res.error(new Error('kaboom'))
  })

  app.get('/503', (req, res) => {
    res.error(503, new Error('uh oh'))
  })

  request(app, '/500', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: '5xx Error',
      statusCode: 500,
    })
  })

  request(app, '/503', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 503)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Service Unavailable',
      message: '5xx Error',
      statusCode: 503,
    })
  })
})

t.test('default onError hook with 4xx status code - production', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(400, new Error('uh oh'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Bad Request',
      message: 'uh oh',
      statusCode: 400,
    })
  })
})
