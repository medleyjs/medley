'use strict'

const t = require('tap')
const medley = require('..')

t.test('501', (t) => {
  t.plan(3)

  const app = medley()

  app.all('/', function(request, reply) {
    reply.send({hello: 'world'})
  })

  app.inject({
    method: 'TRACE',
    url: '/',
  }, (err, response) => {
    t.error(err)
    t.strictEqual(response.statusCode, 501)
    t.strictEqual(response.payload, 'Unsupported request method: TRACE')
  })
})
