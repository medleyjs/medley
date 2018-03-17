'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const fs = require('fs')
const zlib = require('zlib')
const pump = require('pump')
const medley = require('..')
const JSONStream = require('JSONStream')
const send = require('send')
const StreamingJSONStringify = require('streaming-json-stringify')
const Readable = require('stream').Readable

test('should respond with a stream', (t) => {
  t.plan(8)
  const app = medley()

  app.get('/', function(req, response) {
    const stream = fs.createReadStream(__filename, 'utf8')
    response.send(stream)
  })

  app.get('/error', function(req, response) {
    const stream = fs.createReadStream('not-existing-file', 'utf8')
    response.send(stream)
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

  app.get('/', (req, response) => {
    response.send(fs.createReadStream(__filename, 'utf8'))
  })

  app.addHook('onSend', (request, response, payload, next) => {
    t.ok(payload._readableState)
    response.set('content-type', 'application/javascript')
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

  app.get('/', (req, response) => {
    response.send(fs.createReadStream('not-existing-file', 'utf8'))
  })

  app.addHook('onSend', (request, response, payload, next) => {
    t.ok(payload._readableState)
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

  app.get('/', (request, response) => {
    response.send({hello: 'world'})
  })

  app.addHook('onSend', (request, response, payload, next) => {
    const gzStream = zlib.createGzip()

    response.set('content-encoding', 'gzip')
    pump(
      fs.createReadStream(__filename, 'utf8'),
      gzStream,
      t.error
    )
    next(null, gzStream)
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

  app.get('/', function(request, response) {
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

    response.send(reallyLongStream)
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

test('should support stream1 streams', (t) => {
  t.plan(5)
  const app = medley()

  app.get('/', function(request, response) {
    const stream = JSONStream.stringify()
    response.type('application/json').send(stream)
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

test('should support stream2 streams', (t) => {
  t.plan(5)
  const app = medley()

  app.get('/', function(request, response) {
    const stream = new StreamingJSONStringify()
    response.type('application/json').send(stream)
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

test('should support send module 200 and 404', (t) => {
  t.plan(8)
  const app = medley()

  app.get('/', function(req, response) {
    const stream = send(req.stream, __filename)
    response.send(stream)
  })

  app.get('/error', function(req, response) {
    const stream = send(req.stream, 'non-existing-file')
    response.send(stream)
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

test('should handle destroying a stream if headers are already sent', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', (request, response) => {
    t.pass('Received request')

    const chunk = Buffer.alloc(100, 'c')
    const streamUntilHeaders = new Readable({
      read() {
        if (response.headersSent) {
          this.emit('error', new Error('stream error'))
          t.pass('emitted error')
        } else {
          this.push(chunk)
        }
      },
    })

    response.send(streamUntilHeaders)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget(`http://localhost:${app.server.address().port}`, (err) => {
      t.type(err, Error)
      t.equal(err.code, 'ECONNRESET')
    })
  })
})
