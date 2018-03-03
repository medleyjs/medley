'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const fastify = require('..')()

const opts = {
  responseSchema: {
    200: {
      type: 'object',
      properties: {
        hello: {
          type: 'string'
        }
      }
    },
    201: {
      type: 'object',
      properties: {
        hello: {
          type: 'number'
        }
      }
    }
  }
}

fastify.get('/string', opts, (request, reply) => {
  reply.send({ hello: 'world' })
})

fastify.get('/number', opts, (request, reply) => {
  reply.code(201).send({ hello: 55 })
})

fastify.get('/wrong-object-for-schema', opts, (request, reply) => {
  reply.code(201).send({ uno: 1 }) // Will send { }
})

// No checks
fastify.get('/empty', opts, (request, reply) => {
  reply.code(204).send()
})

fastify.get('/400', opts, (request, reply) => {
  reply.code(400).send({ hello: 'DOOM' })
})

fastify.listen(0, err => {
  t.error(err)
  fastify.server.unref()

  test('shorthand - string get ok', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/string'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })

  test('shorthand - number get ok', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/number'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 201)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 55 })
    })
  })

  test('shorthand - wrong-object-for-schema', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/wrong-object-for-schema'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 201)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {})
    })
  })

  test('shorthand - empty', t => {
    t.plan(2)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/empty'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 204)
    })
  })

  test('shorthand - 400', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/400'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 400)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'DOOM' })
    })
  })
})
