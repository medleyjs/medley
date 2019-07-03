'use strict'

const t = require('tap')
const medley = require('..')
const request = require('./utils/request')

t.test('onSend hook error invokes the onErrorSending function and does not affect response', (t) => {
  t.plan(5)

  const onSendError = new Error('onSend error')

  const app = medley({
    onErrorSending(err) {
      t.equal(err, onSendError) // Called twice (once for each onSend hook)
    },
  })

  app.get('/', (req, res) => {
    res.send('body')
  })

  app.addHook('onSend', (req, res, body, next) => {
    next(onSendError)
  })

  app.addHook('onSend', async () => {
    throw onSendError
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'body')
  })
})

t.test('onSend hooks invoke the onErrorSending function and finalErrorHandler if they change the body to an invalid type', (t) => {
  t.plan(4)

  const app = medley({
    onErrorSending(err) {
      t.match(
        err,
        new TypeError("Attempted to send body of invalid type 'object'. Expected a string, Buffer, or stream.")
      )
    },
  })

  app.get('/', (req, res) => {
    res.send('plain text')
  })

  app.addHook('onSend', (req, res, body, next) => {
    next(null, {})
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.strictDeepEqual(JSON.parse(res.body), {
      error: 'Internal Server Error',
      message: "Attempted to send body of invalid type 'object'. Expected a string, Buffer, or stream.",
      statusCode: 500,
    })
  })
})
