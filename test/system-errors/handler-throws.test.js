'use strict'

const t = require('tap')
const medley = require('../..')

t.plan(1)

process.removeAllListeners('uncaughtException')

process.on('uncaughtException', (err) => {
  t.equal(err.message, 'kaboom')
})

const app = medley()

app.route({
  method: 'GET',
  path: '/',
  handler() {
    throw new Error('kaboom')
  },
})

app.inject('/', () => {
  t.fail('should not be called')
})
