'use strict'

const t = require('tap')
const Request = require('../../lib/Request')

t.test('Request object', (t) => {
  t.plan(6)
  const request = new Request('params', 'req', 'query', 'headers')
  t.type(request, Request)
  t.equal(request.params, 'params')
  t.equal(request.req, 'req')
  t.equal(request.query, 'query')
  t.equal(request.headers, 'headers')
  t.equal(request.body, undefined)
})
