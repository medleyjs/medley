'use strict'

const t = require('tap')
const medley = require('../..')
const request = require('../utils/request')

t.plan(1)

t.expectUncaughtException(null, new Error('kaboom'))

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
  // Ignore error
})
