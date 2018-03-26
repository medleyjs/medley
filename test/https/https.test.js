'use strict'

const t = require('tap')
const sget = require('simple-get').concat
const fs = require('fs')
const path = require('path')
const medley = require('../..')

if (require('../testUtils.js').supportsHTTP2) {
  require('./http2')
} else {
  const http2Error = new Error('http2 is available only from Node >= 8.8.0')

  t.throws(() => medley({http2: true}), http2Error)
  t.throws(() => medley({http2: {peerMaxConcurrentStreams: 20}}), http2Error)
  t.throws(() => medley({
    http2: {
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.cert')),
    },
  }), http2Error)
}

var app = medley({
  https: {
    key: fs.readFileSync(path.join(__dirname, 'app.key')),
    cert: fs.readFileSync(path.join(__dirname, 'app.cert')),
  },
})

app.get('/', function(request, response) {
  response.send({hello: 'world'})
})

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  t.test('https get request', (t) => {
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
