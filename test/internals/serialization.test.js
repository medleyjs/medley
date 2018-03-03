'use strict'

const t = require('tap')
const test = t.test

const serializer = require('../../lib/serializer')

test('build schema - missing schema', t => {
  t.plan(1)
  const context = {}
  serializer.build(context)
  t.is(context._jsonSerializers, null)
})

test('build schema - missing output schema', t => {
  t.plan(1)
  const context = {
    schema: {},
  }
  serializer.build(context)
  t.is(context._jsonSerializers, null)
})

test('build schema - output schema', t => {
  t.plan(2)
  const context = {
    schema: {
      response: {
        201: {
          type: 'object',
          properties: {
            hello: {type: 'number'},
          },
        },
      },
    },
  }
  serializer.build(context)
  t.is(context._jsonSerializers['201']({hello: 1}), '{"hello":1}')
  t.is(context._jsonSerializers['201']({hello: false}), '{"hello":false}')
})
