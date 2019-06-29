'use strict'

const t = require('tap')
const request = require('./utils/request')
const medley = require('..')

t.test('config', (t) => {
  t.plan(12)

  const app = medley()

  const testConfig = {
    value1: 'foo',
    value2: true,
  }

  app.get('/get', {
    config: testConfig,
  }, (req, res) => {
    t.equal(res.config, testConfig)
    res.send()
  })

  app.route({
    method: 'GET',
    path: '/route',
    config: testConfig,
    handler: (req, res) => {
      t.equal(res.config, testConfig)
      res.send()
    },
  })

  app.route({
    method: 'GET',
    path: '/no-config',
    handler: (req, res) => {
      t.equal(res.config, undefined)
      res.send()
    },
  })

  app.route({
    method: 'GET',
    path: '/other-config',
    config: null,
    handler: (req, res) => {
      t.equal(res.config, null)
      res.send()
    },
  })

  request(app, '/get', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })

  request(app, '/route', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })

  request(app, '/no-config', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })

  request(app, '/other-config', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })
})
