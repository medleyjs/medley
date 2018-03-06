'use strict'

const t = require('tap')
const Request = require('../../lib/Request')

t.test('Request object', (t) => {
  t.plan(5)
  const request = new Request('req', 'headers', 'params')
  t.type(request, Request)
  t.equal(request.req, 'req')
  t.equal(request.headers, 'headers')
  t.equal(request.params, 'params')
  t.equal(request.body, undefined)
})

t.test('request.query - get', (t) => {
  const request = new Request({url: '/path?search=1'})

  t.deepEqual(request.query, {search: '1'})

  t.end()
})

t.test('request.query - set', (t) => {
  const request = new Request({url: '/path?search=1'})
  request.query = 'string'

  t.equal(request.query, 'string')

  t.end()
})
