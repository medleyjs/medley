'use strict'

const t = require('tap')
const app = require('..')()

function handler() { }

t.equal(app.get('/', handler), app)

t.equal(app.head('/', handler), app)

t.equal(app.post('/', {}, handler), app)

t.equal(app.put('/', [], handler), app)

t.equal(app.patch('/', handler), app)

t.equal(app.delete('/', handler), app)

t.equal(app.options('/', handler), app)

t.equal(app.route({
  method: 'SEARCH',
  path: '/other',
  handler,
}), app)

const subApp = app.createSubApp('/sub')

t.equal(subApp.get('/', handler), subApp)

t.equal(subApp.head('/', handler), subApp)

t.equal(subApp.post('/', {}, handler), subApp)

t.equal(subApp.put('/', [], handler), subApp)

t.equal(subApp.patch('/', handler), subApp)

t.equal(subApp.delete('/', handler), subApp)

t.equal(subApp.options('/', handler), subApp)

t.equal(subApp.route({
  method: 'SEARCH',
  path: '/other',
  handler,
}), subApp)
