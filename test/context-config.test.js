'use strict'

const t = require('tap')
const request = require('./utils/request')
const medley = require('..')

const routeOptions = {
  config: {
    value1: 'foo',
    value2: true,
  },
}

function handler(req, res) {
  res.send(res.route.config)
}

t.test('config', (t) => {
  t.plan(9)
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

  request(app, '/get', {json: true}, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.strictDeepEqual(res.body, routeOptions.config)
  })

  request(app, '/route', {json: true}, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.strictDeepEqual(res.body, routeOptions.config)
  })

  request(app, '/no-config', {json: true}, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.strictDeepEqual(res.body, {})
  })
})
