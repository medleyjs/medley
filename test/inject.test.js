'use strict'

const t = require('tap')
const test = t.test
const Stream = require('stream')
const util = require('util')
const medley = require('..')

test('inject should exist', (t) => {
  t.plan(2)
  const app = medley()
  t.ok(app.inject)
  t.is(typeof app.inject, 'function')
})

test('should wait for the ready event', (t) => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.register((subApp, opts, next) => {
    subApp.get('/', (req, response) => {
      response.send(payload)
    })

    setTimeout(next, 500)
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

test('inject post request', (t) => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload,
  }, (err, res) => {
    t.error(err)
    t.deepEqual(payload, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '17')
  })
})

test('inject post request - send stream', (t) => {
  t.plan(4)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    headers: {'content-type': 'application/json'},
    payload: getStream(),
  }, (err, res) => {
    t.error(err)
    t.deepEqual('{"hello":"world"}', res.payload)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '17')
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

test('inject promisify - waiting for ready event', (t) => {
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

test('inject promisify - after the ready event', (t) => {
  t.plan(2)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, response) => {
    response.send(payload)
  })

  app.ready((err) => {
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

  app.ready((err) => {
    t.error(err)

    // setTimeout because the ready event don't set "started" flag
    // in this iteration of the 'event loop'
    setTimeout(() => {
      const injectParams = {
        method: 'GET',
        url: '/',
      }
      app.inject(injectParams)
        .then((res) => {
          t.strictEqual(res.statusCode, 200)
        })
        .catch(t.fail)
    }, 10)
  })
})

test('should reject in error case', (t) => {
  t.plan(1)
  const app = medley()

  const error = new Error('DOOM!')
  app.register((subApp, opts, next) => {
    setTimeout(next, 500, error)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }).catch((e) => {
    t.strictEqual(e, error)
  })
})

test('should pass any error to the callback', (t) => {
  t.plan(1)

  const app = medley()
  const error = new Error('DOOM!')

  app.register((subApp, opts, next) => {
    setTimeout(next, 500, error)
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
