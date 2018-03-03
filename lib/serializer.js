'use strict'

const compileJSONStringify = require('compile-json-stringify')

function buildSerializers (responseSchema) {
  if (!responseSchema) {
    return null
  }

  const serializers = {}

  Object.keys(responseSchema).forEach((statusCode) => {
    serializers[statusCode] = compileJSONStringify(responseSchema[statusCode])
  })

  return serializers
}

function serialize (context, payload, statusCode) {
  const serializers = context._jsonSerializers

  return serializers !== null && serializers[statusCode] !== undefined
    ? serializers[statusCode](payload)
    : JSON.stringify(payload)
}

module.exports = {buildSerializers, serialize}
