'use strict'

const t = require('tap')

const medley = require('..')

t.test('queryParser', (t) => {
  t.plan(6)

  t.throws(
    () => medley({queryParser: true}),
    new TypeError("'queryParser' option must be an function. Got a 'boolean'")
  )

  t.throws(
    () => medley({queryParser: 'simple'}),
    new TypeError("'queryParser' option must be an function. Got a 'string'")
  )

  const app = medley({
    queryParser: qs => 'querystring: ' + qs,
  })

  app.get('/', (request, reply) => {
    reply.send(request.query)
  })

  app.inject('/?a', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'querystring: a')
  })

  app.inject('/?b=2', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'querystring: b=2')
  })
})
