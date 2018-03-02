'use strict'

const t = require('tap')
const test = t.test

const validation = require('../../lib/validation')

const symbols = validation.symbols

test('Symbols', t => {
  t.plan(1)
  t.is(typeof symbols.responseSchema, 'symbol')
})

test('build schema - missing schema', t => {
  t.plan(1)
  const opts = {}
  validation.build(opts)
  t.is(typeof opts[symbols.responseSchema], 'undefined')
})

test('build schema - missing output schema', t => {
  t.plan(1)
  const opts = { schema: {} }
  validation.build(opts)
  t.is(typeof opts[symbols.responseSchema], 'undefined')
})

test('build schema - output schema', t => {
  t.plan(2)
  const opts = {
    schema: {
      response: {
        '2xx': {
          type: 'object',
          properties: {
            hello: { type: 'string' }
          }
        },
        201: {
          type: 'object',
          properties: {
            hello: { type: 'number' }
          }
        }
      }
    }
  }
  validation.build(opts)
  t.is(typeof opts[symbols.responseSchema]['2xx'], 'function')
  t.is(typeof opts[symbols.responseSchema]['201'], 'function')
})
