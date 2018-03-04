'use strict'

function Request(params, req, query, headers) {
  this.params = params
  this.req = req
  this.query = query
  this.headers = headers
  this.body = undefined
}

function buildRequest(ParentRequest) {
  function _Request(params, req, query, headers) {
    this.params = params
    this.req = req
    this.query = query
    this.headers = headers
    this.body = undefined
  }

  _Request.prototype = new ParentRequest()

  return _Request
}

module.exports = Request
module.exports.buildRequest = buildRequest
