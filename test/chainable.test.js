'use strict'

const t = require('tap')
const test = t.test
const app = require('..')()

function handler() { }

test('chainable - get', (t) => {
  t.plan(1)
  t.equal(app.get('/', handler), app)
})

test('chainable - post', (t) => {
  t.plan(1)
  t.equal(app.post('/', {}, handler), app)
})

test('chainable - route', (t) => {
  t.plan(1)
  t.equal(app.route({
    method: 'PUT',
    url: '/other',
    handler,
  }), app)
})
