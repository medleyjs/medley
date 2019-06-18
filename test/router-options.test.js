'use strict'

const {test} = require('tap')
const medley = require('../')
const request = require('./utils/request')

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

  request(app1, '/test', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'test')
  })

  request(app1, '/test/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'test')
  })

  request(app2, '/test', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'test')
  })

  request(app2, '/test/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
    t.equal(res.body, 'Not Found: GET /test/')
  })

})

test('Should honor maxParamLength option', (t) => {
  t.plan(4)
  const app = medley({maxParamLength: 10})

  app.get('/test/:id', (req, response) => {
    response.send({hello: 'world'})
  })

  request(app, '/test/123456789', (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 200)
  })

  request(app, '/test/123456789abcd', (error, res) => {
    t.error(error)
    t.strictEqual(res.statusCode, 404)
  })
})
