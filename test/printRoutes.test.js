'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('app.printRoutes()', (t) => {
  t.plan(1)

  const app = medley()
  app.get('/test', () => {})
  app.get('/test/hello', () => {})
  app.get('/hello/world', () => {})

  t.type(app.printRoutes(), 'string')
})
