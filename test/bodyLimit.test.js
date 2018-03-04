'use strict'

const medley = require('..')
const sget = require('simple-get').concat
const t = require('tap')
const test = t.test

test('bodyLimit', (t) => {
  t.plan(5)

  try {
    medley({bodyLimit: 1.3})
    t.fail('option must be an integer')
  } catch (err) {
    t.ok(err)
  }

  try {
    medley({bodyLimit: []})
    t.fail('option must be an integer')
  } catch (err) {
    t.ok(err)
  }

  const app = medley({bodyLimit: 1})

  app.post('/', (request, reply) => {
    reply.send({error: 'handler should not be called'})
  })

  app.listen(0, function(err) {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {'Content-Type': 'application/json'},
      body: [],
      json: true,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 413)
    })
  })
})
