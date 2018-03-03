'use strict'

const compileJSONStringify = require('compile-json-stringify')

const responseSchema = Symbol('response-schema')

function getResponseSchema (responseSchemaDefinition) {
  var statusCodes = Object.keys(responseSchemaDefinition)
  return statusCodes.reduce(function (r, statusCode) {
    r[statusCode] = compileJSONStringify(responseSchemaDefinition[statusCode])
    return r
  }, {})
}

function build (context) {
  if (!context.schema) {
    return
  }

  if (context.schema.response) {
    context[responseSchema] = getResponseSchema(context.schema.response)
  }
}

function serialize (context, data, statusCode) {
  var responseSchemaDef = context[responseSchema]
  if (!responseSchemaDef) {
    return JSON.stringify(data)
  }
  if (responseSchemaDef[statusCode]) {
    return responseSchemaDef[statusCode](data)
  }
  var fallbackStatusCode = (statusCode + '')[0] + 'xx'
  if (responseSchemaDef[fallbackStatusCode]) {
    return responseSchemaDef[fallbackStatusCode](data)
  }
  return JSON.stringify(data)
}

module.exports = {build, serialize}
module.exports.symbols = {responseSchema}
