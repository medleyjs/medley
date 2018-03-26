'use strict'

const t = require('tap')
const test = t.test
const stream = require('stream')
const util = require('util')
const medley = require('..')

test('should wait for the app to load before injecting the request', (t) => {
  t.plan(5)

  const app = medley()
  const payload = {hello: 'world'}
  let loaded = false

  app.use((subApp) => {
    subApp.get('/', (req, res) => {
      t.equal(loaded, true)
      res.send(payload)
    })

    subApp.onLoad((done) => {
      setTimeout(() => {
        loaded = true
        done()
      }, 10)
    })
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictDeepEqual(JSON.parse(res.payload), payload)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '17')
  })
})

test('inject response', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '17')
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"hello":"world"}')
  })
})

test('inject get request - response stream', (t) => {
  t.plan(3)

  const app = medley()

  // https://github.com/hapijs/shot/blob/master/test/index.js#L836
  function getStream() {
    function Read() {
      stream.Readable.call(this)
    }

    util.inherits(Read, stream.Readable)

    const word = '{"hello":"world"}'
    var i = 0

    Read.prototype._read = function() {
      this.push(word[i] ? word[i++] : null)
    }

    return new Read()
  }

  app.get('/', (req, res) => {
    res.send(getStream())
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, '{"hello":"world"}')
  })
})

test('inject promisify - waiting for load event', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('')
  })

  return app.inject('/')
    .then((res) => {
      t.equal(res.statusCode, 200)
    })
})

test('inject promisify - after the load event', (t) => {
  t.plan(2)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('')
  })

  app.load((err) => {
    t.error(err)

    app.inject('/')
      .then((res) => {
        t.equal(res.statusCode, 200)
      })
      .catch(t.fail)
  })
})

test('inject promisify - when the server is up', (t) => {
  t.plan(2)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    app.inject('/')
      .then((res) => {
        t.strictEqual(res.statusCode, 200)
      })
      .catch(t.fail)
  })
})

test('should reject in error case', (t) => {
  t.plan(1)

  const app = medley()
  const error = new Error('DOOM!')

  app.onLoad((done) => {
    done(error)
  })

  app.inject('/').catch((err) => {
    t.strictEqual(err, error)
  })
})

test('should pass any onLoad error to the callback', (t) => {
  t.plan(1)

  const app = medley()
  const error = new Error('DOOM!')

  app.onLoad((done) => {
    done(error)
  })

  app.inject('/', (err) => {
    t.equal(err, error)
  })
})
