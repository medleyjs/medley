'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('root app subApp is an object', (t) => {
  t.plan(1)
  t.type(medley(), 'object')
})
