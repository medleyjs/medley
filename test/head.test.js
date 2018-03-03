'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const fastify = require('..')()

const schema = {
  schema: {
    response: {
      200: {
        type: 'null'
      }
    }
  }
}

test('shorthand - head', t => {
  t.plan(1)
  try {
    fastify.head('/', schema, function (req, reply) {
      reply.code(200).send(null)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('missing schema - head', t => {
  t.plan(1)
  try {
    fastify.head('/missing', function (req, reply) {
      reply.code(200).send(null)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

fastify.listen(0, err => {
  t.error(err)
  fastify.server.unref()

  test('shorthand - request head', t => {
    t.plan(2)
    sget({
      method: 'HEAD',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
    })
  })

  test('shorthand - request head missing schema', t => {
    t.plan(2)
    sget({
      method: 'HEAD',
      url: 'http://localhost:' + fastify.server.address().port + '/missing'
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
    })
  })
})
