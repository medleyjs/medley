'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const fastify = require('..')()

const schema = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          hello: {
            type: 'string'
          }
        }
      }
    }
  }
}

const nullSchema = {
  schema: {
    response: {
      200: {
        type: 'null'
      }
    }
  }
}

const numberSchema = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          hello: {
            type: 'number'
          }
        }
      }
    }
  }
}

test('shorthand - get', t => {
  t.plan(1)
  try {
    fastify.get('/', schema, function (req, reply) {
      reply.code(200).send({ hello: 'world' })
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('shorthand - get (return null)', t => {
  t.plan(1)
  try {
    fastify.get('/null', nullSchema, function (req, reply) {
      reply.code(200).send(null)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('missing schema - get', t => {
  t.plan(1)
  try {
    fastify.get('/missing', function (req, reply) {
      reply.code(200).send({ hello: 'world' })
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('custom serializer - get', t => {
  t.plan(1)

  function customSerializer (data) {
    return JSON.stringify(data)
  }

  try {
    fastify.get('/custom-serializer', numberSchema, function (req, reply) {
      reply.code(200).serializer(customSerializer).send({ hello: 'world' })
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('empty response', t => {
  t.plan(1)
  try {
    fastify.get('/empty', function (req, reply) {
      reply.code(200).send()
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('send a falsy boolean', t => {
  t.plan(1)
  try {
    fastify.get('/boolean', function (req, reply) {
      reply.code(200).send(false)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

fastify.listen(0, err => {
  t.error(err)
  fastify.server.unref()

  test('shorthand - request get', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })

  test('shorthand - request get missing schema', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/missing'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })

  test('shorthand - custom serializer', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/custom-serializer'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })

  test('shorthand - empty response', t => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/empty'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '0')
      t.deepEqual(body.toString(), '')
    })
  })

  test('shorthand - send a falsy boolean', t => {
    t.plan(3)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/boolean'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), 'false')
    })
  })

  test('shorthand - send null value', t => {
    t.plan(3)
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/null'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), 'null')
    })
  })
})
