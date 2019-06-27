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

app.addHook('onError', async (_, req, res) => {
  res.send()
})

app.addHook('onSend', (req) => {
  req.stream.socket.destroy() // Close the socket to allow the test to finish
  throw new Error('kaboom')
})

request(app, '/', () => {
  // Ignore error
})
