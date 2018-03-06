'use strict'

function Request(req, headers, params, query) {
  this.req = req
  this.headers = headers
  this.params = params
  this.query = query
  this.body = undefined
}

Request.buildRequest = function(ParentRequest) {
  function _Request(req, headers, params, query) {
    this.req = req
    this.headers = headers
    this.params = params
    this.query = query
    this.body = undefined
  }

  _Request.prototype = Object.create(ParentRequest.prototype)
  _Request.prototype.constructor = _Request

  return _Request
}

module.exports = Request
