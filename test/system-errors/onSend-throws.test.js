'use strict'

const t = require('tap')
const medley = require('../..')

t.plan(1)

process.removeAllListeners('unhandledRejection')

process.on('unhandledRejection', (err) => {
  t.equal(err.message, 'kaboom')
})

const app = medley()

app.route({
  method: 'GET',
  path: '/',
  async handler(req, res) { // eslint-disable-line require-await
    res.send()
  },
})

app.addHook('onSend', () => {
  throw new Error('kaboom')
})

app.inject('/', () => {
  t.fail('should not be called')
})
