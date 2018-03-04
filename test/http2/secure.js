'use strict'

const t = require('tap')
const test = t.test
const fs = require('fs')
const path = require('path')
const medley = require('../..')
const h2url = require('h2url')
const msg = {hello: 'world'}

var app
try {
  app = medley({
    http2: true,
    https: {
      key: fs.readFileSync(path.join(__dirname, '..', 'https', 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, '..', 'https', 'app.cert')),
    },
  })
  t.pass('Key/cert successfully loaded')
} catch (e) {
  t.fail('Key/cert loading failed', e)
}

app.get('/', function(req, reply) {
  reply.code(200).send(msg)
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('https get request', async (t) => {
    t.plan(3)

    const url = `https://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)
    t.deepEqual(JSON.parse(res.body), msg)
  })
})
