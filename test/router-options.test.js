'use strict'

const test = require('tap').test
const sget = require('simple-get')
const medley = require('../')

test('Should honor ignoreTrailingSlash option', (t) => {
  t.plan(4)
  const app = medley({
    ignoreTrailingSlash: true,
  })

  app.get('/test', (req, res) => {
    res.send('test')
  })

  app.listen(0, (err) => {
    app.server.unref()
    if (err) t.threw(err)

    const baseUrl = 'http://127.0.0.1:' + app.server.address().port

    sget.concat(baseUrl + '/test', (err, res, data) => {
      if (err) t.threw(err)
      t.is(res.statusCode, 200)
      t.is(data.toString(), 'test')
    })

    sget.concat(baseUrl + '/test/', (err, res, data) => {
      if (err) t.threw(err)
      t.is(res.statusCode, 200)
      t.is(data.toString(), 'test')
    })
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
