'use strict'

function Context(app, jsonSerializers, handler, config, bodyLimit) {
  this.jsonSerializers = jsonSerializers
  this.handler = handler
  this.config = config
  this.parserOptions = {
    limit: bodyLimit || null,
  }
  this.Reply = app._Reply
  this.Request = app._Request
  this.bodyParser = app._bodyParser
  this.errorHandler = app._errorHandler
  this.onRequest = null
  this.preHandler = null
  this.onSend = null
  this.onResponse = null
  this.notFoundContext = null
}

module.exports = Context
