'use strict'

if (require('./testUtils.js').supportsAsyncAwait) {
  require('./hooks.async')
}

const t = require('tap')
const test = t.test
const http = require('http')
const sget = require('simple-get').concat
const stream = require('stream')
const medley = require('..')
const fp = require('fastify-plugin')

test('hooks', (t) => {
  t.plan(22)

  const payload = {hello: 'world'}
  const app = medley()

  app.addHook('onRequest', function(request, response, next) {
    request.onRequestVal = 'the request is coming'
    response.onRequestVal = 'the response has come'
    if (request.method === 'DELETE') {
      next(new Error('some error'))
    } else {
      next()
    }
  })

  app.addHook('preHandler', function(request, response, next) {
    request.preHandlerVal = 'the request is coming'
    response.preHandlerVal = 'the response has come'
    if (request.req.method === 'HEAD') {
      next(new Error('some error'))
    } else {
      next()
    }
  })

  app.addHook('onSend', function(request, response, _payload, next) {
    t.ok('onSend called')
    next()
  })

  app.addHook('onFinished', function(request, response) {
    t.equal(request.onRequestVal, 'the request is coming')
    t.equal(response.res.finished, true)
  })

  app.get('/', function(request, response) {
    t.is(request.onRequestVal, 'the request is coming')
    t.is(response.onRequestVal, 'the response has come')
    t.is(request.preHandlerVal, 'the request is coming')
    t.is(response.preHandlerVal, 'the response has come')
    response.send(payload)
  })

  app.head('/', function(req, response) {
    response.send(payload)
  })

  app.delete('/', function(req, response) {
    response.send(payload)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'HEAD',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })

    sget({
      method: 'DELETE',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('onRequest hook should support encapsulation / 1', (t) => {
  t.plan(6)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.addHook('onRequest', (request, response, next) => {
      t.equal(request.url, '/plugin')
      t.equal(response.sent, false)
      next()
    })

    subApp.get('/plugin', (request, response) => {
      response.send()
    })

    next()
  })

  app.get('/root', (request, response) => {
    response.send()
  })

  app.inject('/root', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })

  app.inject('/plugin', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })
})

test('onRequest hook should support encapsulation / 2', (t) => {
  t.plan(3)
  const app = medley()
  var pluginInstance

  app.addHook('onRequest', () => {})

  app.register((subApp, opts, next) => {
    subApp.addHook('onRequest', () => {})
    pluginInstance = subApp
    next()
  })

  app.ready((err) => {
    t.error(err)
    t.is(app._hooks.onRequest.length, 1)
    t.is(pluginInstance._hooks.onRequest.length, 2)
  })
})

test('onRequest hook should support encapsulation / 3', (t) => {
  t.plan(13)
  const app = medley()

  app.addHook('onRequest', (request, response, next) => {
    request.first = true
    next()
  })

  app.get('/first', (request, response) => {
    t.equal(request.first, true)
    t.equal(request.second, undefined)
    response.send({hello: 'world'})
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onRequest', (request, response, next) => {
      request.second = true
      next()
    })

    subApp.get('/second', (request, response) => {
      t.equal(request.first, true)
      t.equal(request.second, true)
      response.send({hello: 'world'})
    })

    next()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/first',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/second',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('preHandler hook should support encapsulation / 5', (t) => {
  t.plan(19)
  const app = medley()

  app.decorateRequest('hello', 'world')

  app.addHook('preHandler', function(request, response, next) {
    t.equal(request.hello, 'world')
    request.first = true
    next()
  })

  app.get('/first', (request, response) => {
    t.equal(request.hello, 'world')
    t.equal(request.hello2, undefined)
    t.ok(request.first)
    t.notOk(request.second)
    response.send({hello: 'world'})
  })

  app.register((subApp, opts, next) => {
    subApp.decorateRequest('hello2', 'world')

    subApp.addHook('preHandler', function(request, response, next) {
      t.equal(request.hello, 'world')
      t.equal(request.hello2, 'world')
      request.second = true
      next()
    })

    subApp.get('/second', (request, response) => {
      t.ok(request.first)
      t.ok(request.second)
      response.send({hello: 'world'})
    })

    next()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/first',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/second',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('onFinished hook should support encapsulation / 1', (t) => {
  t.plan(5)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.addHook('onFinished', (request, response) => {
      t.strictEqual(response.plugin, true)
    })

    subApp.get('/plugin', (request, response) => {
      response.plugin = true
      response.send()
    })

    next()
  })

  app.get('/root', (request, response) => {
    response.send()
  })

  app.inject('/root', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })

  app.inject('/plugin', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
  })
})

test('onFinished hook should support encapsulation / 2', (t) => {
  t.plan(3)
  const app = medley()
  var pluginInstance

  app.addHook('onFinished', () => {})

  app.register((subApp, opts, next) => {
    subApp.addHook('onFinished', () => {})
    pluginInstance = subApp
    next()
  })

  app.ready((err) => {
    t.error(err)
    t.is(app._hooks.onFinished.length, 1)
    t.is(pluginInstance._hooks.onFinished.length, 2)
  })
})

test('onFinished hook should support encapsulation / 3', (t) => {
  t.plan(15)
  const app = medley()

  app.addHook('onFinished', (request, response) => {
    t.ok(request)
    t.ok(response)
  })

  app.get('/first', (req, response) => {
    response.send({hello: 'world'})
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onFinished', (request, response) => {
      t.ok(request)
      t.ok(response)
    })

    subApp.get('/second', (req, response) => {
      response.send({hello: 'world'})
    })

    next()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/first',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/second',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('onFinished hook should run if the client closes the connection', (t) => {
  t.plan(6)

  const app = medley()

  app.addHook('onFinished', (request, response) => {
    t.equal(request.method, 'GET')
    t.equal(response.res.finished, false)
  })

  var clientRequest

  app.get('/', () => {
    clientRequest.abort()
    t.pass('aborted request')
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    clientRequest = http.get(`http://localhost:${app.server.address().port}`)

    clientRequest.on('error', (err) => {
      t.type(err, Error)
      t.equal(err.code, 'ECONNRESET')
    })
  })
})

test('onSend hook should support encapsulation / 1', (t) => {
  t.plan(3)
  const app = medley()
  var pluginInstance

  app.addHook('onSend', () => {})

  app.register((subApp, opts, next) => {
    subApp.addHook('onSend', () => {})
    pluginInstance = subApp
    next()
  })

  app.ready((err) => {
    t.error(err)
    t.is(app._hooks.onSend.length, 1)
    t.is(pluginInstance._hooks.onSend.length, 2)
  })
})

test('onSend hook should support encapsulation / 2', (t) => {
  t.plan(18)
  const app = medley()

  app.decorateRequest('hello', 'world')

  app.addHook('onSend', (request, response, payload, next) => {
    t.equal(request.hello, 'world')
    t.ok('onSend called')
    next()
  })

  app.get('/first', (request, response) => {
    t.equal(request.hello, 'world')
    t.equal(request.hello2, undefined)
    response.send({hello: 'world'})
  })

  app.register((subApp, opts, next) => {
    subApp.decorateRequest('hello2', 'world')

    subApp.addHook('onSend', (request, response, payload, next) => {
      t.equal(request.hello, 'world')
      t.equal(request.hello2, 'world')
      t.ok('onSend called')
      next()
    })

    subApp.get('/second', (request, response) => {
      response.send({hello: 'world'})
    })

    next()
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/first',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/second',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('onSend hook is called after payload is serialized and headers are set', (t) => {
  t.plan(24)
  const app = medley()

  app.register((subApp, opts, next) => {
    const payload = {hello: 'world'}

    subApp.addHook('onSend', (request, response, serializedPayload, next) => {
      t.deepEqual(JSON.parse(serializedPayload), payload)
      t.strictEqual(response.res.getHeader('Content-Type'), 'application/json')
      next()
    })

    subApp.get('/json', (request, response) => {
      response.send(payload)
    })

    next()
  })

  app.register((subApp, opts, next) => {
    subApp.addHook('onSend', (request, response, serializedPayload, next) => {
      t.strictEqual(serializedPayload, 'some text')
      t.strictEqual(response.res.getHeader('Content-Type'), 'text/plain')
      next()
    })

    subApp.get('/text', (request, response) => {
      response.send('some text')
    })

    next()
  })

  app.register((subApp, opts, next) => {
    const payload = Buffer.from('buffer payload')

    subApp.addHook('onSend', (request, response, serializedPayload, next) => {
      t.strictEqual(serializedPayload, payload)
      t.strictEqual(response.res.getHeader('Content-Type'), 'application/octet-stream')
      next()
    })

    subApp.get('/buffer', (request, response) => {
      response.send(payload)
    })

    next()
  })

  app.register((subApp, opts, next) => {
    var chunk = 'stream payload'
    const payload = new stream.Readable({
      read() {
        this.push(chunk)
        chunk = null
      },
    })

    subApp.addHook('onSend', (request, response, serializedPayload, next) => {
      t.strictEqual(serializedPayload, payload)
      t.strictEqual(response.res.getHeader('Content-Type'), 'application/octet-stream')
      next()
    })

    subApp.get('/stream', (request, response) => {
      response.send(payload)
    })

    next()
  })

  app.inject({
    method: 'GET',
    url: '/json',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
    t.strictEqual(res.headers['content-length'], '17')
  })

  app.inject({
    method: 'GET',
    url: '/text',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(res.payload, 'some text')
    t.strictEqual(res.headers['content-length'], '9')
  })

  app.inject({
    method: 'GET',
    url: '/buffer',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(res.payload, 'buffer payload')
    t.strictEqual(res.headers['content-length'], '14')
  })

  app.inject({
    method: 'GET',
    url: '/stream',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(res.payload, 'stream payload')
    t.strictEqual(res.headers['transfer-encoding'], 'chunked')
  })
})

test('onSend hooks can modify payload', (t) => {
  t.plan(10)
  const app = medley()
  const payload = {hello: 'world'}
  const modifiedPayload = {hello: 'modified'}
  const anotherPayload = '"winter is coming"'

  app.addHook('onSend', (request, response, serializedPayload, next) => {
    t.ok('onSend called')
    t.deepEqual(JSON.parse(serializedPayload), payload)
    next(null, serializedPayload.replace('world', 'modified'))
  })

  app.addHook('onSend', (request, response, serializedPayload, next) => {
    t.ok('onSend called')
    t.deepEqual(JSON.parse(serializedPayload), modifiedPayload)
    next(null, anotherPayload)
  })

  app.addHook('onSend', (request, response, serializedPayload, next) => {
    t.ok('onSend called')
    t.strictEqual(serializedPayload, anotherPayload)
    next()
  })

  app.get('/', (req, response) => {
    response.send(payload)
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.payload, anotherPayload)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '18')
  })
})

test('onSend hooks can clear payload', (t) => {
  t.plan(6)
  const app = medley()

  app.addHook('onSend', (request, response, payload, next) => {
    t.ok('onSend called')
    response.code(304)
    next(null, null)
  })

  app.get('/', (req, response) => {
    response.send({hello: 'world'})
  })

  app.inject({
    method: 'GET',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 304)
    t.strictEqual(res.payload, '')
    t.strictEqual(res.headers['content-length'], undefined)
    t.strictEqual(res.headers['content-type'], 'application/json')
  })
})

test('onSend hook throws', (t) => {
  t.plan(7)
  const app = medley()
  app.addHook('onSend', (request, response, payload, next) => {
    if (request.req.method === 'DELETE') {
      next(new Error('some error'))
      return
    }
    next()
  })

  app.get('/', (req, response) => {
    response.send({hello: 'world'})
  })

  app.delete('/', (req, response) => {
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
    sget({
      method: 'DELETE',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('cannot add hook after listening', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', function(request, response) {
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    t.tearDown(app.server.close.bind(app.server))

    try {
      app.addHook('onRequest', () => {})
      t.fail()
    } catch (e) {
      t.pass()
    }
  })
})

test('onRequest hooks should be able to send a response', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('onRequest', (request, response) => {
    response.send('hello')
  })

  app.addHook('onRequest', () => {
    t.fail('this should not be called')
  })

  app.addHook('preHandler', () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', (request, response, payload, next) => {
    t.equal(payload, 'hello')
    next()
  })

  app.addHook('onFinished', () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('preHandler hooks should be able to send a response', (t) => {
  t.plan(5)
  const app = medley()

  app.addHook('preHandler', (req, response) => {
    response.send('hello')
  })

  app.addHook('preHandler', () => {
    t.fail('this should not be called')
  })

  app.addHook('onSend', (request, response, payload, next) => {
    t.equal(payload, 'hello')
    next()
  })

  app.addHook('onFinished', () => {
    t.ok('called')
  })

  app.get('/', function() {
    t.fail('this should not be called')
  })

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.is(res.payload, 'hello')
  })
})

test('Register a hook after a plugin inside a plugin', (t) => {
  t.plan(6)
  const app = medley()

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('preHandler', function(req, response, next) {
      t.ok('called')
      next()
    })

    subApp.get('/', function(request, response) {
      response.send({hello: 'world'})
    })

    next()
  }))

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('preHandler', function(req, response, next) {
      t.ok('called')
      next()
    })

    subApp.addHook('preHandler', function(req, response, next) {
      t.ok('called')
      next()
    })

    next()
  }))

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Register a hook after a plugin inside a plugin (with beforeHandler)', (t) => {
  t.plan(7)
  const app = medley()

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('preHandler', function(req, response, next) {
      t.ok('called')
      next()
    })

    subApp.get('/', {
      beforeHandler: (req, response, next) => {
        t.ok('called')
        next()
      },
    }, function(request, response) {
      response.send({hello: 'world'})
    })

    next()
  }))

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('preHandler', function(req, response, next) {
      t.ok('called')
      next()
    })

    subApp.addHook('preHandler', function(req, response, next) {
      t.ok('called')
      next()
    })

    next()
  }))

  app.inject({
    url: '/',
    method: 'GET',
  }, (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('Register hooks inside a plugin after an encapsulated plugin', (t) => {
  t.plan(7)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.get('/', function(request, response) {
      response.send({hello: 'world'})
    })

    next()
  })

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('onRequest', function(request, response, next) {
      t.ok('called')
      next()
    })

    subApp.addHook('preHandler', function(request, response, next) {
      t.ok('called')
      next()
    })

    subApp.addHook('onSend', function(request, response, payload, next) {
      t.ok('called')
      next()
    })

    subApp.addHook('onFinished', function() {
      t.ok('called')
    })

    next()
  }))

  app.inject('/', (err, res) => {
    t.error(err)
    t.is(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('onRequest hooks should run in the order in which they are defined', (t) => {
  t.plan(9)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.addHook('onRequest', (request, response, next) => {
      t.strictEqual(request.previous, undefined)
      request.previous = 1
      next()
    })

    subApp.get('/', (request, response) => {
      t.strictEqual(request.previous, 5)
      response.send({hello: 'world'})
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('onRequest', (request, response, next) => {
        t.strictEqual(request.previous, 1)
        request.previous = 2
        next()
      })
      next()
    }))

    next()
  })

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('onRequest', (request, response, next) => {
      t.strictEqual(request.previous, 2)
      request.previous = 3
      next()
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('onRequest', (request, response, next) => {
        t.strictEqual(request.previous, 3)
        request.previous = 4
        next()
      })
      next()
    }))

    subApp.addHook('onRequest', (request, response, next) => {
      t.strictEqual(request.previous, 4)
      request.previous = 5
      next()
    })

    next()
  }))

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('preHandler hooks should run in the order in which they are defined', (t) => {
  t.plan(9)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.addHook('preHandler', function(request, response, next) {
      t.strictEqual(request.previous, undefined)
      request.previous = 1
      next()
    })

    subApp.get('/', function(request, response) {
      t.strictEqual(request.previous, 5)
      response.send({hello: 'world'})
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('preHandler', function(request, response, next) {
        t.strictEqual(request.previous, 1)
        request.previous = 2
        next()
      })
      next()
    }))

    next()
  })

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('preHandler', function(request, response, next) {
      t.strictEqual(request.previous, 2)
      request.previous = 3
      next()
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('preHandler', function(request, response, next) {
        t.strictEqual(request.previous, 3)
        request.previous = 4
        next()
      })
      next()
    }))

    subApp.addHook('preHandler', function(request, response, next) {
      t.strictEqual(request.previous, 4)
      request.previous = 5
      next()
    })

    next()
  }))

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('onSend hooks should run in the order in which they are defined', (t) => {
  t.plan(8)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.addHook('onSend', function(request, response, payload, next) {
      t.strictEqual(request.previous, undefined)
      request.previous = 1
      next()
    })

    subApp.get('/', function(request, response) {
      response.send({})
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('onSend', function(request, response, payload, next) {
        t.strictEqual(request.previous, 1)
        request.previous = 2
        next()
      })
      next()
    }))

    next()
  })

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('onSend', function(request, response, payload, next) {
      t.strictEqual(request.previous, 2)
      request.previous = 3
      next()
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('onSend', function(request, response, payload, next) {
        t.strictEqual(request.previous, 3)
        request.previous = 4
        next()
      })
      next()
    }))

    subApp.addHook('onSend', function(request, response, payload, next) {
      t.strictEqual(request.previous, 4)
      next(null, '5')
    })

    next()
  }))

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), 5)
  })
})

test('onFinished hooks should run in the order in which they are defined', (t) => {
  t.plan(8)
  const app = medley()

  app.register(function(subApp, opts, next) {
    subApp.addHook('onFinished', (request, response) => {
      t.strictEqual(response.previous, undefined)
      response.previous = 1
    })

    subApp.get('/', function(request, response) {
      response.send({hello: 'world'})
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('onFinished', (request, response) => {
        t.strictEqual(response.previous, 1)
        response.previous = 2
      })
      next()
    }))

    next()
  })

  app.register(fp(function(subApp, opts, next) {
    subApp.addHook('onFinished', (request, response) => {
      t.strictEqual(response.previous, 2)
      response.previous = 3
    })

    subApp.register(fp(function(i, opts, next) {
      i.addHook('onFinished', (request, response) => {
        t.strictEqual(response.previous, 3)
        response.previous = 4
      })
      next()
    }))

    subApp.addHook('onFinished', (request, response) => {
      t.strictEqual(response.previous, 4)
    })

    next()
  }))

  app.inject('/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})
