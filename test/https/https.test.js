'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const fs = require('fs')
const path = require('path')
const medley = require('../..')

try {
  var app = medley({
    https: {
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.cert')),
    },
  })
  t.pass('Key/cert successfully loaded')
} catch (e) {
  t.fail('Key/cert loading failed', e)
}

test('https get', (t) => {
  t.plan(1)
  try {
    app.get('/', function(req, reply) {
      reply.code(200).send({hello: 'world'})
    })
    t.pass()
  } catch (e) {
    t.fail()
  }
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('https get request', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'https://localhost:' + app.server.address().port,
      rejectUnauthorized: false,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})
