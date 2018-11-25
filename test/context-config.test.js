'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')

const routeOptions = {
  config: {
    value1: 'foo',
    value2: true,
  },
}

function handler(request, response) {
  response.send(response.route.config)
}

test('config', (t) => {
  t.plan(10)
  const app = medley()

  app.get('/get', {
    config: Object.assign({}, routeOptions.config),
  }, handler)

  app.route({
    method: 'GET',
    path: '/route',
    handler,
    config: Object.assign({}, routeOptions.config),
  })

  app.route({
    method: 'GET',
    path: '/no-config',
    handler,
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/get',
      json: true,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEquals(body, Object.assign(routeOptions.config))
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/route',
      json: true,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEquals(body, Object.assign(routeOptions.config))
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no-config',
      json: true,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEquals(body, {})
    })
  })
})
