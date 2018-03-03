'use strict'

const t = require('tap')
const test = t.test

const serializer = require('../../lib/serializer')

test('build serializers - missing schema', t => {
  t.plan(2)

  t.equal(serializer.buildSerializers(), null)
  t.equal(serializer.buildSerializers(null), null)
})

test('build serializers -empty schema', t => {
  t.plan(1)

  t.deepEqual(serializer.buildSerializers({}), {})
})

test('build serializers - output schema', t => {
  t.plan(2)

  const serializers = serializer.buildSerializers({
    201: {
      type: 'object',
      properties: {
        hello: {type: 'number'},
      },
    },
  })

  t.is(serializers['201']({hello: 1}), '{"hello":1}')
  t.is(serializers['201']({hello: false}), '{"hello":false}')
})
