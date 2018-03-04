'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('405', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  const injectOptions = {
    method: 'TRACE',
    url: '/',
    payload: '{}',
  }
  app.inject(injectOptions)
    .then((response) => {
      t.strictEqual(response.statusCode, 405)
    })
    .catch(t.fail)
})
