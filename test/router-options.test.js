'use strict'

const test = require('tap').test
const medley = require('../')

test('Should honor strictRouting option', (t) => {
  t.plan(12)
  const app1 = medley()
  const app2 = medley({
    strictRouting: true,
  })

  app1.get('/test', (req, res) => {
    res.send('test')
  })
  app2.get('/test', (req, res) => {
    res.send('test')
  })

  app1.inject('/test', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'test')
  })

  app1.inject('/test/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'test')
  })

  app2.inject('/test', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'test')
  })

  app2.inject('/test/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.payload, 'Not Found: GET /test/')
  })

})

test('Should honor maxParamLength option', (t) => {
  t.plan(4)
  const app = medley({maxParamLength: 10})

  app.get('/test/:id', (req, response) => {
    response.send({hello: 'world'})
  })

  app.inject({
    method: 'GET',
    url: '/test/123456789',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 200)
  })

  app.inject({
    method: 'GET',
    url: '/test/123456789abcd',
  }, (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 404)
  })
})
