'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const fs = require('fs')
const zlib = require('zlib')
const pump = require('pump')
const medley = require('..')
const errors = require('http-errors')
const JSONStream = require('JSONStream')
const send = require('send')
const Readable = require('stream').Readable

test('should respond with a stream', (t) => {
  t.plan(8)
  const app = medley()

  app.get('/', function(req, reply) {
    const stream = fs.createReadStream(__filename, 'utf8')
    reply.send(stream)
  })

  app.get('/error', function(req, reply) {
    const stream = fs.createReadStream('not-existing-file', 'utf8')
    reply.send(stream)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget(`http://localhost:${app.server.address().port}`, function(err, response, data) {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'application/octet-stream')
      t.strictEqual(response.statusCode, 200)

      fs.readFile(__filename, (err, expected) => {
        t.error(err)
        t.equal(expected.toString(), data.toString())
      })
    })

    sget(`http://localhost:${app.server.address().port}/error`, function(err, response) {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('should trigger the onSend hook', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, reply) => {
    reply.send(fs.createReadStream(__filename, 'utf8'))
  })

  app.addHook('onSend', (request, reply, next) => {
    t.ok(reply.payload._readableState)
    reply.header('Content-Type', 'application/javascript')
    next()
  })

  app.inject({
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/javascript')
    t.strictEqual(res.payload, fs.readFileSync(__filename, 'utf8'))
    app.close()
  })
})

test('should trigger the onSend hook only once if pumping the stream fails', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, reply) => {
    reply.send(fs.createReadStream('not-existing-file', 'utf8'))
  })

  app.addHook('onSend', (request, reply, next) => {
    t.ok(reply.payload._readableState)
    next()
  })

  app.listen(0, (err) => {
    t.error(err)

    app.server.unref()

    sget(`http://localhost:${app.server.address().port}`, function(err, response) {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('onSend hook stream', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', function(req, reply) {
    reply.send({hello: 'world'})
  })

  app.addHook('onSend', (req, reply, next) => {
    const gzStream = zlib.createGzip()

    reply.header('Content-Encoding', 'gzip')
    pump(
      fs.createReadStream(__filename, 'utf8'),
      gzStream,
      t.error
    )
    reply.payload = gzStream
    next()
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-encoding'], 'gzip')
    const file = fs.readFileSync(__filename, 'utf8')
    const payload = zlib.gunzipSync(res.rawPayload)
    t.strictEqual(payload.toString('utf-8'), file)
    app.close()
  })
})

test('Destroying streams prematurely', (t) => {
  t.plan(3)

  const app = medley()
  const stream = require('stream')
  const http = require('http')

  app.get('/', function(request, reply) {
    t.pass('Received request')

    var sent = false
    var reallyLongStream = new stream.Readable({
      read() {
        if (!sent) {
          this.push(Buffer.from('hello\n'))
        }
        sent = true
      },
    })

    reply.send(reallyLongStream)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    var port = app.server.address().port

    http.get(`http://localhost:${port}`, function(response) {
      t.strictEqual(response.statusCode, 200)
      response.on('readable', function() {
        response.destroy()
      })
      response.on('close', function() {
        t.pass('Response closed')
      })
    })
  })
})

test('should respond with a stream1', (t) => {
  t.plan(5)
  const app = medley()

  app.get('/', function(request, reply) {
    const stream = JSONStream.stringify()
    reply.type('application/json').send(stream)
    stream.write({hello: 'world'})
    stream.end({a: 42})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget(`http://localhost:${app.server.address().port}`, function(err, response, body) {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'application/json')
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(JSON.parse(body), [{hello: 'world'}, {a: 42}])
    })
  })
})

test('return a 404 if the stream emits a 404 error', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', function(request, reply) {
    t.pass('Received request')

    var reallyLongStream = new Readable({
      read() {
        setImmediate(() => {
          this.emit('error', new errors.NotFound())
        })
      },
    })

    reply.send(reallyLongStream)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    var port = app.server.address().port

    sget(`http://localhost:${port}`, function(err, response) {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'application/json')
      t.strictEqual(response.statusCode, 404)
    })
  })
})

test('should support send module 200 and 404', (t) => {
  t.plan(8)
  const app = medley()

  app.get('/', function(req, reply) {
    const stream = send(req.req, __filename)
    reply.send(stream)
  })

  app.get('/error', function(req, reply) {
    const stream = send(req.req, 'non-existing-file')
    reply.send(stream)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget(`http://localhost:${app.server.address().port}`, function(err, response, data) {
      t.error(err)
      t.strictEqual(response.headers['content-type'], 'application/octet-stream')
      t.strictEqual(response.statusCode, 200)

      fs.readFile(__filename, (err, expected) => {
        t.error(err)
        t.equal(expected.toString(), data.toString())
      })
    })

    sget(`http://localhost:${app.server.address().port}/error`, function(err, response) {
      t.error(err)
      t.strictEqual(response.statusCode, 404)
    })
  })
})
