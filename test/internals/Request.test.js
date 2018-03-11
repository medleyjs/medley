'use strict'

const t = require('tap')
const medley = require('../..')
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

t.test('request.method - get', (t) => {
  const req = {method: 'GET'}
  t.equal(new Request(req).method, 'GET')
  t.end()
})

t.test('request.url - get', (t) => {
  const req = {url: '/some-url'}
  t.equal(new Request(req).url, '/some-url')
  t.end()
})

t.test('request.query - get', (t) => {
  const req = {url: '/path?search=1'}
  t.deepEqual(new Request(req).query, {search: '1'})
  t.end()
})

t.test('request.query - set', (t) => {
  const req = {url: '/path?search=1'}
  const request = new Request(req)

  request.query = 'string'
  t.equal(request.query, 'string')

  t.end()
})

t.test('request.querystring - get', (t) => {
  t.equal(new Request({url: '/'}).querystring, '')
  t.equal(new Request({url: '/no-query'}).querystring, '')
  t.equal(new Request({url: '/?'}).querystring, '')
  t.equal(new Request({url: '/path?'}).querystring, '')
  t.equal(new Request({url: '/path?search=1'}).querystring, 'search=1')
  t.equal(new Request({url: '/?qu?ery'}).querystring, 'qu?ery')
  t.equal(new Request({url: '/??query'}).querystring, '?query')
  t.equal(new Request({url: '/?query?'}).querystring, 'query?')
  t.equal(new Request({url: '/?a&b=1%23-&c='}).querystring, 'a&b=1%23-&c=')
  t.end()
})

t.test('request.body should be available in onSend hooks and undefined in onFinished hooks', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (request, reply) => {
    request.body = 'body'
    reply.send()
  })

  app.addHook('onSend', (request, reply, payload, next) => {
    t.equal(request.body, 'body')
    next()
  })

  app.addHook('onFinished', (request) => {
    t.equal(request.body, undefined)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })
})
