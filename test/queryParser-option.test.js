'use strict'

const t = require('tap')

const medley = require('..')

t.test('queryParser', (t) => {
  t.plan(8)

  try {
    medley({queryParser: true})
    t.fail('option must be a function')
  } catch (err) {
    t.equal(err.message, "'queryParser' option must be an function. Got 'true'")
  }

  try {
    medley({queryParser: 'simple'})
    t.fail('option must be a function')
  } catch (err) {
    t.ok(err)
  }

  const app = medley({queryParser: qs => qs})

  app.get('/', (request, reply) => {
    reply.send(request.query)
  })

  app.inject('/?a', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'a')
  })

  app.inject('/?b=2', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'b=2')
  })
})
