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
  t.plan(4)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.code(505).error(new Error('reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false)
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})

t.test('onSend hook error sets the right status code - custom code', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, reply) => {
    reply.code(505).error(new Error('reply error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (request, reply, next) => {
    t.equal(onSendCalled, false)
    onSendCalled = true
    next(new StatusError(502, 'onSend error'))
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 502)
    t.equal(JSON.parse(res.payload).message, 'onSend error')
  })
})
