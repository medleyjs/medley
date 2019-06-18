'use strict'

const t = require('tap')
const medley = require('../..')
const request = require('../utils/request')

t.plan(1)

process.removeAllListeners('uncaughtException')

process.on('uncaughtException', (err) => {
  t.equal(err.message, 'kaboom')
})

const app = medley()

app.route({
  method: 'GET',
  path: '/',
  handler(req) {
    req.stream.socket.destroy()
    throw new Error('kaboom')
  },
})

request(app, '/', () => {
  // Ignroe error
})
