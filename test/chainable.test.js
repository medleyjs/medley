'use strict'

const t = require('tap')
const test = t.test
const fastify = require('..')()

function handler() { }

test('chainable - get', t => {
  t.plan(1)
  t.equal(fastify.get('/', handler), fastify)
})

test('chainable - post', t => {
  t.plan(1)
  t.equal(fastify.post('/', {}, handler), fastify)
})

test('chainable - route', t => {
  t.plan(1)
  t.equal(fastify.route({
    method: 'PUT',
    url: '/other',
    handler,
  }), fastify)
})
