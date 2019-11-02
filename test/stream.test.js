'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const fs = require('fs')
const stream = require('stream')
const http = require('http')
const zlib = require('zlib')
const pump = require('pump')
const medley = require('..')
const JSONStream = require('JSONStream')
const send = require('send')
const StreamingJSONStringify = require('streaming-json-stringify')
const {Readable} = require('stream')

const FILE_TEXT = fs.readFileSync(__filename, 'utf8')

test('should respond with a stream', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', function(req, res) {
    const fileStream = fs.createReadStream(__filename, 'utf8')
    res.send(fileStream)
  })

  app.get('/error', function(req, res) {
    const fileStream = fs.createReadStream('not-existing-file', 'utf8')
    res.send(fileStream)
  })

  request(app, '/', function(err, res) {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/octet-stream')
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, FILE_TEXT)
  })

  request(app, '/error', function(err, res) {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

test('should trigger the onSend hook', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, res) => {
    res.send(fs.createReadStream(__filename, 'utf8'))
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.ok(body._readableState)
    res.setHeader('content-type', 'application/javascript')
    next()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/javascript')
    t.strictEqual(res.body, FILE_TEXT)
    app.close()
  })
})

test('should trigger the onSend hook only once if pumping the stream fails', (t) => {
  t.plan(3)
  const app = medley()

  app.get('/', (req, res) => {
    res.send(fs.createReadStream('not-existing-file', 'utf8'))
  })

  app.addHook('onSend', (req, res, body, next) => {
    t.ok(body._readableState)
    next()
  })

  request(app, '/', function(err, res) {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

test('onSend hook stream', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.addHook('onSend', (req, res, body, next) => {
    const gzStream = zlib.createGzip()

    res.setHeader('content-encoding', 'gzip')
    pump(
      fs.createReadStream(__filename, 'utf8'),
      gzStream,
      t.error
    )
    next(null, gzStream)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.headers['content-encoding'], 'gzip')
    t.strictEqual(res.body, FILE_TEXT)
    app.close()
  })
})

test('Destroying streams prematurely', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', function(req, res) {
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

    res.send(reallyLongStream)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    const {port} = app.server.address()

    http.get(`http://localhost:${port}`, (res) => {
      t.strictEqual(res.statusCode, 200)
      res.on('readable', () => {
        res.destroy()
      })
      res.on('close', () => {
        t.pass('Response closed')
      })
    })
  })
})

test('should support stream1 streams', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', function(req, res) {
    const jsonStream = JSONStream.stringify()
    res.type('application/json').send(jsonStream)
    jsonStream.write({hello: 'world'})
    jsonStream.end({a: 42})
  })

  request(app, '/', function(err, res) {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictEqual(res.statusCode, 200)
    t.strictDeepEqual(JSON.parse(res.body), [{hello: 'world'}, {a: 42}])
  })
})

test('should support stream2 streams', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', function(req, res) {
    const jsonStream = new StreamingJSONStringify()
    res.type('application/json').send(jsonStream)
    jsonStream.write({hello: 'world'})
    jsonStream.end({a: 42})
  })

  request(app, '/', function(err, res) {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictEqual(res.statusCode, 200)
    t.strictDeepEqual(JSON.parse(res.body), [{hello: 'world'}, {a: 42}])
  })
})

test('should support send module 200 and 404', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', function(req, res) {
    const sendStream = send(req.stream, __filename)
    res.send(sendStream)
  })

  app.get('/error', function(req, res) {
    const sendStream = send(req.stream, 'non-existing-file')
    res.send(sendStream)
  })

  request(app, '/', function(err, res) {
    t.error(err)
    t.strictEqual(res.headers['content-type'], 'application/octet-stream')
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, FILE_TEXT)
  })

  request(app, '/error', function(err, res) {
    t.error(err)
    t.strictEqual(res.statusCode, 404)
  })
})

test('should handle destroying a stream if headers are already sent', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    t.pass('Received request')

    const chunk = Buffer.alloc(100, 'c')
    const streamUntilHeaders = new Readable({
      read() {
        if (res.headersSent) {
          this.emit('error', new Error('stream error'))
          t.pass('emitted error')
        } else {
          this.push(chunk)
        }
      },
    })

    res.send(streamUntilHeaders)
  })

  request(app, '/', (err) => {
    t.type(err, Error)
    t.equal(err.code, 'ECONNRESET')
  })
})

test('should call the onErrorSending function if the stream was destroyed prematurely', (t) => {
  t.plan(5)

  function onErrorSending(err) {
    t.type(err, Error)
    t.equal(err.message, 'premature close')
  }

  const app = medley({onErrorSending})

  app.get('/', (req, res) => {
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

    res.send(reallyLongStream)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    http.get(`http://localhost:${app.server.address().port}`, (res) => {
      t.equal(res.statusCode, 200)

      res.on('readable', () => {
        res.destroy()
      })
      res.on('close', () => {
        t.pass('Response closed')
      })
    })
  })
})

test('should call the onErrorSending function if a stream was destroyed with headers already sent', (t) => {
  t.plan(5)

  const streamError = new Error('stream error')

  function onErrorSending(err) {
    t.equal(err, streamError)
  }

  const app = medley({onErrorSending})

  app.get('/', (req, res) => {
    t.pass('Received request')

    const chunk = Buffer.alloc(100, 'c')
    const streamUntilHeaders = new Readable({
      read() {
        if (res.headersSent) {
          this.emit('error', streamError)
          t.pass('emitted error')
        } else {
          this.push(chunk)
        }
      },
    })

    res.send(streamUntilHeaders)
  })

  request(app, '/', (err) => {
    t.type(err, Error)
    t.equal(err.code, 'ECONNRESET')
  })
})

test('should call the onErrorSending function if a stream errors before headers are sent', (t) => {
  t.plan(3)

  const streamError = new Error('stream error')
  const app = medley({
    onErrorSending(err) {
      t.equal(err, streamError)
    },
  })

  app.get('/', (req, res) => {
    const errorStream = new Readable({
      read() {
        this.emit('error', streamError)
      },
    })
    res.send(errorStream)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
  })
})

test('should throw if onErrorSending is not a function', (t) => {
  t.throws(
    () => medley({onErrorSending: true}),
    new TypeError("'onErrorSending' option must be a function. Got value of type 'boolean'")
  )
  t.throws(
    () => medley({onErrorSending: ''}),
    new TypeError("'onErrorSending' option must be a function. Got value of type 'string'")
  )
  t.end()
})
