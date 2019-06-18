'use strict'

const t = require('tap')
const medley = require('..')
const request = require('./utils/request')

class StatusError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

t.test('onSend hook error sets the right status code - default', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(505, new Error('response error'))
  })

  app.addHook('onSend', (req, res, payload, next) => {
    next(new Error('onSend error'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.body).message, 'onSend error')
  })
})

t.test('onSend hook error sets the right status code - custom code', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(505, new Error('response error'))
  })

  app.addHook('onSend', (req, res, payload, next) => {
    next(new StatusError(502, 'onSend error'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 502)
    t.equal(JSON.parse(res.body).message, 'onSend error')
  })
})

t.test('onSend hooks error if they change the payload to an invalid type', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/', (req, res) => {
    return Promise.resolve()
      .then(() => res.send('plaintext'))
      .catch((err) => {
        t.type(err, TypeError)
        t.equal(
          err.message,
          'Attempted to send payload of invalid type \'object\'. Expected a string, Buffer, or stream.'
        )
        // Hack to make the request complete (there's no other way to do this)
        res.sent = false
        res.send()
      })
  })

  app.addHook('onSend', (req, res, payload, next) => {
    next(null, {})
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '')
  })
})

t.test('onSend hooks do not run again if they errored before - res.send() starts', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('text')
  })

  var onSendCalled = false
  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.body).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - res.error() starts', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('response error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.body).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - res.send() starts + custom error handler res.send()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('text')
  })

  var onSendCalled = false
  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, req, res) => {
    t.equal(err.message, 'onSend error')
    res.send('Custom error handler message')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.body, 'Custom error handler message')
  })
})

t.test('onSend hooks do not run again if they errored before - res.error() starts + custom error handler res.send()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('response error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, req, res) => {
    t.equal(err.message, 'response error')
    res.send('Custom error handler message')
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.body).message, 'onSend error')
  })
})

t.test('onSend hooks do not run again if they errored before - res.send() starts + custom error handler res.error()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    res.send('text')
  })

  var onSendCalled = false
  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, req, res) => {
    t.equal(err.message, 'onSend error')
    res.error(new Error('Custom error handler message'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.body).message, 'Custom error handler message')
  })
})

t.test('onSend hooks do not run again if they errored before - res.error() starts + custom error handler res.error()', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    res.error(new Error('response error'))
  })

  var onSendCalled = false
  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(onSendCalled, false, 'onSend called twice')
    onSendCalled = true
    next(new Error('onSend error'))
  })

  app.setErrorHandler((err, req, res) => {
    t.equal(err.message, 'response error')
    res.error(new Error('Custom error handler message'))
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(JSON.parse(res.body).message, 'onSend error')
  })
})
