'use strict'

const querystring = require('querystring')

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

;(function defineGettersAndSetters(properties) {
  const descriptor = {configurable: true, enumerable: true}

  for (const key in properties) {
    Object.assign(properties[key], descriptor)
  }

  Object.defineProperties(Request.prototype, properties)
})({
  method: {
    get() {
      return this.req.method
    },
  },

  query: {
    get() {
      if (this._query === null) {
        this._query = querystring.parse(this.querystring)
      }
      return this._query
    },
    set(value) {
      this._query = value
    },
  },

  querystring: {
    get() {
      const {url} = this.req
      const qIndex = url.indexOf('?')
      return qIndex === -1 ? '' : url.slice(qIndex + 1)
    },
  },

  url: {
    get() {
      return this.req.url
    },
  },
})

module.exports = Request
