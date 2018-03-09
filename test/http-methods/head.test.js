'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const app = require('../..')()

const options = {
  responseSchema: {
    200: {
      type: 'null',
    },
  },
}

test('shorthand - head', (t) => {
  t.plan(1)
  try {
    app.head('/', options, function(req, reply) {
      reply.send(null)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('missing schema - head', (t) => {
  t.plan(1)
  try {
    app.head('/missing', function(req, reply) {
      reply.send(null)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('shorthand - request head', (t) => {
    t.plan(2)
    sget({
      method: 'HEAD',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
    })
  })

  test('shorthand - request head missing schema', (t) => {
    t.plan(2)
    sget({
      method: 'HEAD',
      url: 'http://localhost:' + app.server.address().port + '/missing',
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
    })
  })
})
