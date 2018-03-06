'use strict'

const querystring = require('querystring')
const parseQuery = require('./parseQuery')

function Request(req, headers, params) {
  this.req = req
  this.headers = headers
  this.params = params
  this.body = undefined
  this._query = null
}

Request.buildRequest = function(ParentRequest) {
  function _Request(req, headers, params) {
    this.req = req
    this.headers = headers
    this.params = params
    this.body = undefined
    this._query = null
  }

  _Request.prototype = new ParentRequest()
  _Request.prototype.constructor = _Request

  return _Request
}

Request.prototype._queryParser = querystring.parse

Object.defineProperties(Request.prototype, {
  query: {
    get() {
      if (this._query === null) {
        this._query = parseQuery(this.req.url, this._queryParser)
      }
      return this._query
    },
    set(value) {
      this._query = value
    },
  },
})

module.exports = Request
