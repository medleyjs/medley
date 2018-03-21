'use strict'

const t = require('tap')
const http = require('http')
const medley = require('../..')

const supportedMethods = http.METHODS

t.test('app should a route shorthand for all supported HTTP methods', (t) => {
  t.plan(supportedMethods.length * 2)

  const app = medley()

  function handler(req, res) {
    res.send(req.method)
  }

  supportedMethods.forEach((method) => {
    app[method.toLowerCase()]('/', handler)
  })

  supportedMethods.forEach((method) => {
    app.inject({
      method,
      url: '/',
    }, (err, res) => {
      t.error(err)
      t.equal(res.payload, method)
    })
  })
})
