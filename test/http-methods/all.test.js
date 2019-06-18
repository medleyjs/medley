'use strict'

const {test} = require('tap')
const request = require('../utils/request')
const medley = require('../..')

const supportedMethods = require('http').METHODS.filter(method => method !== 'CONNECT')

test('app.all() should handle all methods for a path', (t) => {
  t.plan(supportedMethods.length * 2)

  const app = medley()

  app.all('/', (req, res) => {
    res.send({method: req.method})
  })

  for (const method of supportedMethods) {
    request(app, {method, url: '/'}, (err, res) => {
      t.error(err)
      if (method === 'HEAD') {
        t.equal(res.body, '')
      } else {
        t.strictDeepEqual(JSON.parse(res.body), {method})
      }
    })
  }
})
