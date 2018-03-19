'use strict'

const t = require('tap')
const medley = require('..')

t.test('res.notFound() throws if called after a response is sent', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('send')
    try {
      res.notFound()
    } catch (err) {
      t.equal(err.message, 'Cannot call .notFound() when a response has already been sent')
    }
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'send')
  })
})

t.test('res.notFound() should invoke the not-found handler', (t) => {
  t.plan(8)

  const app = medley()

  app.get('/not-found', (req, res) => {
    res.notFound()
  })

  app.use('/prefixed', function(subApp) {
    subApp.get('/not-found', (req, res) => {
      res.notFound()
    })

    subApp.setNotFoundHandler((req, res) => {
      res.status(404).send('Custom not found response')
    })
  })

  app.inject('/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Not Found: GET /not-found')
  })

  app.inject('/prefixed/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Custom not found response')
  })
})

t.test('res.notFound() should send a basic response if called inside a not-found handler', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/', (req, res) => {
    t.pass('/ handler called')
    res.notFound()
  })

  app.setNotFoundHandler((req, res) => {
    res.notFound()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Not Found: GET /')
  })

  app.inject('/not-found', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.payload, 'Not Found: GET /not-found')
  })
})
