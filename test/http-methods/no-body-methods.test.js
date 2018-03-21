'use strict'

const t = require('tap')
const http = require('http')
const medley = require('../..')

http.METHODS.forEach((method) => {
  if (/^(?:POST|PUT|PATCH|OPTIONS|DELETE)$/.test(method)) {
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
})
