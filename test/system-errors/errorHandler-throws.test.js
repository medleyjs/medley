'use strict'

const t = require('tap')
const medley = require('../..')
const request = require('../utils/request')

t.plan(1)

process.on('unhandledRejection', (err) => {
  t.equal(err.message, 'kaboom')
})

const app = medley()

app.route({
  method: 'GET',
  path: '/',
  handler(req, res) {
    res.error(new Error())
  },
})

app.setErrorHandler(async (_, req, res) => { // eslint-disable-line require-await
  res.send()
})

app.addHook('onSend', (req) => {
  req.stream.socket.destroy()
  throw new Error('kaboom')
})

request(app, '/', () => {
  // Ignore error
})
