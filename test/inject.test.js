'use strict'

const t = require('tap')
const test = t.test
const Stream = require('stream')
const util = require('util')
const medley = require('..')

test('inject should exist', t => {
  t.plan(2)
  const app = medley()
  t.ok(app.inject)
  t.is(typeof app.inject, 'function')
})

test('should wait for the ready event', t => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.register((instance, opts, next) => {
    instance.get('/', (req, reply) => {
      reply.send(payload)
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

test('inject get request', t => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, reply) => {
    reply.send(payload)
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

test('inject get request - code check', t => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, reply) => {
    reply.code(201).send(payload)
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

test('inject get request - headers check', t => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, reply) => {
    reply.header('content-type', 'text/plain').send('')
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual('', res.payload)
    t.strictEqual(res.headers['content-type'], 'text/plain')
    t.strictEqual(res.headers['content-length'], '0')
  })
})

test('inject get request - querystring', t => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, reply) => {
    reply.send(req.query)
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

test('inject get request - params', t => {
  t.plan(4)
  const app = medley()

  app.get('/:hello', (req, reply) => {
    reply.send(req.params)
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

test('inject get request - wildcard', t => {
  t.plan(4)
  const app = medley()

  app.get('/test/*', (req, reply) => {
    reply.send(req.params)
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

test('inject get request - headers', t => {
  t.plan(4)
  const app = medley()

  app.get('/', (req, reply) => {
    reply.send(req.headers)
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

test('inject post request', t => {
  t.plan(4)
  const app = medley()
  const payload = {hello: 'world'}

  app.post('/', (req, reply) => {
    reply.send(req.body)
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

test('inject post request - send stream', t => {
  t.plan(4)
  const app = medley()

  app.post('/', (req, reply) => {
    reply.send(req.body)
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

test('inject get request - reply stream', t => {
  t.plan(3)
  const app = medley()

  app.get('/', (req, reply) => {
    reply.send(getStream())
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

test('inject promisify - waiting for ready event', t => {
  t.plan(1)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, reply) => {
    reply.send(payload)
  })

  const injectParams = {
    method: 'GET',
    url: '/',
  }
  app.inject(injectParams)
    .then(res => {
      t.strictEqual(res.statusCode, 200)
    })
    .catch(t.fail)
})

test('inject promisify - after the ready event', t => {
  t.plan(2)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, reply) => {
    reply.send(payload)
  })

  app.ready(err => {
    t.error(err)

    const injectParams = {
      method: 'GET',
      url: '/',
    }
    app.inject(injectParams)
      .then(res => {
        t.strictEqual(res.statusCode, 200)
      })
      .catch(t.fail)
  })
})

test('inject promisify - when the server is up', t => {
  t.plan(2)
  const app = medley()
  const payload = {hello: 'world'}

  app.get('/', (req, reply) => {
    reply.send(payload)
  })

  app.ready(err => {
    t.error(err)

    // setTimeout because the ready event don't set "started" flag
    // in this iteration of the 'event loop'
    setTimeout(() => {
      const injectParams = {
        method: 'GET',
        url: '/',
      }
      app.inject(injectParams)
        .then(res => {
          t.strictEqual(res.statusCode, 200)
        })
        .catch(t.fail)
    }, 10)
  })
})

test('should reject in error case', t => {
  t.plan(1)
  const app = medley()

  const error = new Error('DOOM!')
  app.register((instance, opts, next) => {
    setTimeout(next, 500, error)
  })

  app.inject({
    method: 'GET',
    url: '/',
  })
    .catch(e => {
      t.strictEqual(e, error)
    })
})

// https://github.com/hapijs/shot/blob/master/test/index.js#L836
function getStream() {
  const Read = function() {
    Stream.Readable.call(this)
  }
  util.inherits(Read, Stream.Readable)
  const word = '{"hello":"world"}'
  var i = 0

  Read.prototype._read = function(size) {
    this.push(word[i] ? word[i++] : null)
  }

  return new Read()
}
