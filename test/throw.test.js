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

test('should throw on unsupported method in `extraBodyParsingMethods` option', (t) => {
  t.plan(1)

  t.throws(
    () => medley({extraBodyParsingMethods: ['TROLL']}),
    /is not a supported method/
  )
})
