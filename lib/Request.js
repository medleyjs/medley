'use strict'

function Request(req, headers, params, query) {
  this.req = req
  this.headers = headers
  this.params = params
  this.query = query
  this.body = undefined
}

function buildRequest(ParentRequest) {
  function _Request(req, headers, params, query) {
    this.req = req
    this.headers = headers
    this.params = params
    this.query = query
    this.body = undefined
  }

  _Request.prototype = new ParentRequest()

  return _Request
}

module.exports = Request
module.exports.buildRequest = buildRequest
