'use strict'

const t = require('tap')
const http = require('http')
const runBodyTests = require('./body-tests')
const medley = require('../..')

http.METHODS.forEach((method) => {
  if (method === 'CONNECT') {
    return // CONNECT doesn't work the same as other methods
  }

  if (/^(?:POST|PUT|PATCH|OPTIONS|DELETE)$/.test(method)) {
    t.throws(
      () => medley({extraBodyParsingMethods: [method]}),
      new RangeError(`"${method}" already has request bodies parsed`)
    )
    return
  }

  t.test(method + ' request ignores request body', (t) => {
    t.plan(3)

    const app = medley()

    app.route({
      method,
      url: '/',
      handler(req, res) {
        t.equal(req.body, undefined)
        res.send()
      },
    })

    app.inject({
      method,
      url: '/',
      payload: {json: 'body'},
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
    })
  })

  if (method === 'HEAD') {
    return // Skip the full test for HEAD requests since they can't return a request body
  }

  runBodyTests(method, {extraBodyParsingMethods: [method]})
})
