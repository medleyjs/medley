'use strict'

const t = require('tap')
const medley = require('..')

class StatusError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

t.test('onSend hook error sets the right status code - default', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.code(505).error(new Error('reply error'))
  })

  app.addHook('onSend', (request, reply, next) => {
    next(new Error('onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hook error sets the right status code - custom code', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.code(505).error(new Error('reply error'))
  })

  app.addHook('onSend', (request, reply, next) => {
    next(new StatusError(502, 'onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 502)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - reply.send() starts', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.send('text')
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - reply.error() starts', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new Error('reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - Not-found handler triggered', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new StatusError(404, 'reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - reply.send() starts + custom error handler reply.send()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.send('text')
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, request, reply) => {
    t.equal(err.message, 'onSend error')
    reply.send('Custom error handler message')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'Custom error handler message')
  })
})

t.test('onSend hooks do not run again if they errored before - reply.error() starts + custom error handler reply.send()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new Error('reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, request, reply) => {
    t.equal(err.message, 'reply error')
    reply.send('Custom error handler message')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - Not-found handler triggered + custom error handler reply.send()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new StatusError(404, 'reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, request, reply) => {
    t.equal(err.message, 'onSend error')
    reply.send('Custom error handler message')
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain')
    t.equal(res.payload, 'Custom error handler message')
  })
})

t.test('onSend hooks do not run again if they errored before - reply.send() starts + custom error handler reply.error()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.send('text')
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, request, reply) => {
    t.equal(err.message, 'onSend error')
    reply.error(new Error('Custom error handler message'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.payload).message, 'Custom error handler message')
  })
})

t.test('onSend hooks do not run again if they errored before - reply.error() starts + custom error handler reply.error()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new Error('reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, request, reply) => {
    t.equal(err.message, 'reply error')
    reply.error(new Error('Custom error handler message'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - Not-found handler triggered + custom error handler reply.error()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.error(new StatusError(404, 'reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, request, reply) => {
    t.equal(err.message, 'onSend error')
    reply.error(new Error('Custom error handler message'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.payload).message, 'Custom error handler message')
  })
})
