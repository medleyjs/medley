'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const app = require('..')()

const stringSchema = {
  responseSchema: {
    200: {
      type: 'object',
      properties: {
        hello: {
          type: 'string',
        },
      },
    },
  },
}

const nullSchema = {
  responseSchema: {
    200: {
      type: 'null',
    },
  },
}

test('shorthand - get', (t) => {
  t.plan(1)
  try {
    app.get('/', stringSchema, function(req, reply) {
      reply.code(200).send({hello: 'world'})
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('shorthand - get (return null)', (t) => {
  t.plan(1)
  try {
    app.get('/null', nullSchema, function(req, reply) {
      reply.code(200).send(null)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('missing schema - get', (t) => {
  t.plan(1)
  try {
    app.get('/missing', function(req, reply) {
      reply.code(200).send({hello: 'world'})
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('empty response', (t) => {
  t.plan(1)
  try {
    app.get('/empty', function(req, reply) {
      reply.code(200).send()
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('send a falsy boolean', (t) => {
  t.plan(1)
  try {
    app.get('/boolean', function(req, reply) {
      reply.code(200).send(false)
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('shorthand - request get', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })

  test('shorthand - request get missing schema', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/missing',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })

  test('shorthand - empty response', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/empty',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '0')
      t.deepEqual(body.toString(), '')
    })
  })

  test('shorthand - send a falsy boolean', (t) => {
    t.plan(3)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/boolean',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), 'false')
    })
  })

  test('shorthand - send null value', (t) => {
    t.plan(3)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/null',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), 'null')
    })
  })
})
