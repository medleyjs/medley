'use strict'

const t = require('tap')
const medley = require('../..')
const app = medley()

let errored = false

app.route({
  method: 'POST',
  path: '/jsonBody',
  handler() {
    throw new Error('kaboom')
  },
})

const reqOpts = {
  method: 'POST',
  url: '/jsonBody',
  payload: {
    hello: 'world',
  },
}

process.on('uncaughtException', (err) => {
  errored = true
  t.equal(err.message, 'kaboom')
})

app.inject(reqOpts, () => {
  t.fail('should not be called')
})

process.on('beforeExit', () => {
  t.ok(errored)
})
