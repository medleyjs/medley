'use strict'

const t = require('tap')
const fs = require('fs')
const path = require('path')
const medley = require('../..')
const h2url = require('h2url')
const sget = require('simple-get').concat

const msg = {hello: 'world'}

t.test('plain', (t) => {
  t.plan(4)

  var app = medley({
    http2: true,
  })

  app.get('/', function(req, reply) {
    reply.send(msg)
  })

  app.listen(0, async (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)

    t.deepEqual(JSON.parse(res.body), msg)
  })
})

t.test('secure', (t) => {
  t.plan(4)

  var app = medley({
    http2: true,
    https: {
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.cert')),
    },
  })

  app.get('/', function(req, reply) {
    reply.send(msg)
  })

  app.listen(0, async (err) => {
    t.error(err)
    app.server.unref()

    const url = `https://localhost:${app.server.address().port}`
    const res = await h2url.concat({url})

    t.strictEqual(res.headers[':status'], 200)
    t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)
    t.deepEqual(JSON.parse(res.body), msg)
  })
})

t.test('secure with fallback', (t) => {
  t.plan(6)

  var app = medley({
    http2: true,
    https: {
      allowHTTP1: true,
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.cert')),
    },
  })

  app.get('/', function(req, reply) {
    reply.send(msg)
  })

  app.post('/', function(req, reply) {
    reply.send(req.body)
  })

  app.get('/error', async function() {
    await Promise.resolve()
    throw new Error('kaboom')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    t.test('https get error', async (t) => {
      t.plan(1)

      const url = `https://localhost:${app.server.address().port}/error`
      const res = await h2url.concat({url})

      t.strictEqual(res.headers[':status'], 500)
    })

    t.test('https post', async (t) => {
      t.plan(2)

      const url = `https://localhost:${app.server.address().port}`
      const res = await h2url.concat({
        url,
        method: 'POST',
        body: JSON.stringify({hello: 'http2'}),
        headers: {
          'content-type': 'application/json',
        },
      })

      t.strictEqual(res.headers[':status'], 200)
      t.deepEqual(JSON.parse(res.body), {hello: 'http2'})
    })

    t.test('https get request', async (t) => {
      t.plan(3)

      const url = `https://localhost:${app.server.address().port}`
      const res = await h2url.concat({url})

      t.strictEqual(res.headers[':status'], 200)
      t.strictEqual(res.headers['content-length'], '' + JSON.stringify(msg).length)
      t.deepEqual(JSON.parse(res.body), msg)
    })

    t.test('http1 get request', (t) => {
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

    t.test('http1 get error', (t) => {
      t.plan(2)
      sget({
        method: 'GET',
        url: 'https://localhost:' + app.server.address().port + '/error',
        rejectUnauthorized: false,
      }, (err, response) => {
        t.error(err)
        t.strictEqual(response.statusCode, 500)
      })
    })
  })
})
