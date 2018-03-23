'use strict'

const t = require('tap')
const test = t.test
const Stream = require('stream')
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

test('inject get request', (t) => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, response) => {
    response.send(payload)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.deepEqual(payload, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '17')
  })
})

test('inject get request - code check', (t) => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, response) => {
    response.status(201).send(payload)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.deepEqual(payload, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 201)
    t.strictEqual(res.headers['content-length'], '17')
  })
})

test('inject get request - headers check', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, response) => {
    response.send('')
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual('', res.payload)
    t.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.strictEqual(res.headers['content-length'], '0')
  })
})

test('inject get request - querystring', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, response) => {
    response.send(req.query)
  })

  app.inject({
    method: 'GET',
    url: '/?hello=world',
  }, (err, res) => {
    t.error(err)
    t.deepEqual({hello: 'world'}, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '17')
  })
})

test('inject get request - params', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/:hello', (req, response) => {
    response.send(req.params)
  })

  app.inject({
    method: 'GET',
    url: '/world',
  }, (err, res) => {
    t.error(err)
    t.deepEqual({hello: 'world'}, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '17')
  })
})

test('inject get request - wildcard', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/test/*', (req, response) => {
    response.send(req.params)
  })

  app.inject({
    method: 'GET',
    url: '/test/wildcard',
  }, (err, res) => {
    t.error(err)
    t.deepEqual({'*': 'wildcard'}, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '16')
  })
})

test('inject get request - headers', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, response) => {
    response.send(req.headers)
  })

  app.inject({
    method: 'GET',
    url: '/',
    headers: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    t.strictEqual('world', JSON.parse(res.payload).hello)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '69')
  })
})

test('inject get request - response stream', (t) => {
  t.plan(3)
  const app = medley()

  app.get('/', (req, response) => {
    response.send(getStream())
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.deepEqual('{"hello":"world"}', res.payload)
    t.strictEqual(res.statusCode, 200)
  })
})

test('inject promisify - waiting for load event', (t) => {
  t.plan(1)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, response) => {
    response.send(payload)
  })

  const injectParams = {
    method: 'GET',
    url: '/',
  }
  app.inject(injectParams)
    .then((res) => {
      t.strictEqual(res.statusCode, 200)
    })
    .catch(t.fail)
})

test('inject promisify - after the load event', (t) => {
  t.plan(2)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, response) => {
    response.send(payload)
  })

  app.load((err) => {
    t.error(err)

    const injectParams = {
      method: 'GET',
      url: '/',
    }
    app.inject(injectParams)
      .then((res) => {
        t.strictEqual(res.statusCode, 200)
      })
      .catch(t.fail)
  })
})

test('inject promisify - when the server is up', (t) => {
  t.plan(2)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, response) => {
    response.send(payload)
  })

  app.load((err) => {
    t.error(err)

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

  app.inject({
    method: 'GET',
    url: '/',
  }).catch((err) => {
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

  app.inject({
    method: 'GET',
    url: '/',
  }, (err) => {
    t.equal(err, error)
  })
})

// https://github.com/hapijs/shot/blob/master/test/index.js#L836
function getStream() {
  function Read() {
    Stream.Readable.call(this)
  }

  util.inherits(Read, Stream.Readable)

  const word = '{"hello":"world"}'
  var i = 0

  Read.prototype._read = function() {
    this.push(word[i] ? word[i++] : null)
  }

  return new Read()
}
