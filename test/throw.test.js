'use strict'

const test = require('tap').test
const medley = require('..')

test('medley should throw on wrong options', (t) => {
  t.plan(1)

  t.throws(
    () => medley('string'),
    new TypeError('Options must be an object')
  )
})
