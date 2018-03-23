'use strict'

const t = require('tap')
const test = t.test
const medley = require('../..')

const supportedMethods = require('http').METHODS

test('app.all should add all the methods to the same URL', (t) => {
  t.plan(supportedMethods.length * 2)

  const app = medley()

  app.all('/', (request, response) => {
    response.send({method: request.method})
  })

  supportedMethods.forEach(injectRequest)

  function injectRequest(method) {
    app.inject({method, url: '/'}, (err, res) => {
      t.error(err)
      t.strictDeepEqual(JSON.parse(res.payload), {method})
    })
  }
})
