'use strict'

const compileJSONStringify = require('compile-json-stringify')

function buildResponseSerializers (statusCodeSchemas) {
  if (!statusCodeSchemas) {
    return null
  }

  const serializers = {}

  Object.keys(statusCodeSchemas).forEach((statusCode) => {
    serializers[statusCode] = compileJSONStringify(statusCodeSchemas[statusCode])
  })

  return serializers
}

function build (context) {
  const {schema} = context

  context._jsonSerializers = buildResponseSerializers(schema && schema.response)
}

function serialize (context, payload, statusCode) {
  const serializers = context._jsonSerializers

  return serializers !== null && serializers[statusCode] !== undefined
    ? serializers[statusCode](payload)
    : JSON.stringify(payload)
}

module.exports = {build, serialize}
