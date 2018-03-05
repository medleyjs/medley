'use strict'

const t = require('tap')
const test = t.test
const medley = require('../..')

const supportedMethods = ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS']

test('app.all should add all the methods to the same URL', (t) => {
  t.plan(supportedMethods.length * 2)

  const app = medley()

  app.all('/', (request, reply) => {
    reply.send({method: request.req.method})
  })

  supportedMethods.forEach(injectRequest)

  function injectRequest(method) {
    const options = {
      url: '/',
      method,
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      options.payload = {hello: 'world'}
    }

    app.inject(options, (err, res) => {
      t.error(err)
      var payload = JSON.parse(res.payload)
      t.deepEqual(payload, {method})
    })
  }
})
