'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')

test('contentTypeParser should add a custom async parser', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, reply) => {
    reply.send(req.body)
  })

  app.options('/', (req, reply) => {
    reply.send(req.body)
  })

  app.addContentTypeParser('application/jsoff', async function(req) {
    const ret = await Promise.resolve(req)
    return ret
  })

  app.listen(0, (err) => {
    t.error(err)

    t.tearDown(() => app.close())

    t.test('in POST', (t) => {
      t.plan(3)

      sget({
        method: 'POST',
        url: 'http://localhost:' + app.server.address().port,
        body: '{"hello":"world"}',
        headers: {
          'Content-Type': 'application/jsoff',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })

    t.test('in OPTIONS', (t) => {
      t.plan(3)

      sget({
        method: 'OPTIONS',
        url: 'http://localhost:' + app.server.address().port,
        body: '{"hello":"world"}',
        headers: {
          'Content-Type': 'application/jsoff',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })
  })
})
