'use strict'

const t = require('tap')
const runBodyTests = require('./body-tests')
const medley = require('../..')

const methods = [
  'GET',
  'HEAD',
  'DELETE',
  'POST',
  'PUT',
  'PATCH',
  'OPTIONS',
  'MOVE', // WebDAV method
]

methods.forEach((method) => {
  if (/^(?:POST|PUT|PATCH|OPTIONS)$/.test(method)) {
    t.throws(
      () => medley({extraBodyParsingMethods: [method]}),
      new RangeError(`Bodies are already parsed for "${method}" requests`)
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
