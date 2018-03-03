'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const Fastify = require('..')

const routeOptions = {
  config: {
    value1: 'foo',
    value2: true
  }
}

function handler (req, reply) {
  reply.send(reply.context.config)
}

test('config', t => {
  t.plan(10)
  const fastify = Fastify()

  fastify.get('/get', {
    config: Object.assign({}, routeOptions.config)
  }, handler)

  fastify.route({
    method: 'GET',
    url: '/route',
    handler: handler,
    config: Object.assign({}, routeOptions.config)
  })

  fastify.route({
    method: 'GET',
    url: '/no-config',
    handler: handler
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/get',
      json: true
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEquals(body, Object.assign({url: '/get'}, routeOptions.config))
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/route',
      json: true
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEquals(body, Object.assign({url: '/route'}, routeOptions.config))
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/no-config',
      json: true
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEquals(body, {url: '/no-config'})
    })
  })
})
