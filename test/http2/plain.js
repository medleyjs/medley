'use strict'

const t = require('tap')
const test = t.test
const medley = require('../..')
const h2url = require('h2url')
const msg = {hello: 'world'}

var app
try {
  app = medley({
    http2: true,
  })
  t.pass('http2 successfully loaded')
} catch (e) {
  t.fail('http2 loading failed', e)
}

app.get('/', function(req, reply) {
  reply.send(msg)
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('http get request', async (t) => {
    t.plan(3)

    const url = `http://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)

    t.deepEqual(JSON.parse(res.body), msg)
  })
})
