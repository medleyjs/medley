'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const app = require('..')()

test('shorthand - delete', (t) => {
  t.plan(1)
  try {
    app.delete('/', (request, reply) => {
      reply.send({hello: 'world'})
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

test('missing schema - delete', (t) => {
  t.plan(1)
  try {
    app.delete('/missing', function(req, reply) {
      reply.send({hello: 'world'})
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('shorthand - request delete', (t) => {
    t.plan(4)
    sget({
      method: 'DELETE',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })

  test('shorthand - request delete missing schema', (t) => {
    t.plan(4)
    sget({
      method: 'DELETE',
      url: 'http://localhost:' + app.server.address().port + '/missing',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})
