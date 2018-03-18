'use strict'

const defineProperties = require('./utils/defineProperties')
const querystringParse = require('querystring').parse

module.exports = {
  buildRequest(ParentRequest, trustProxy) {
    function Request(stream, headers, params) {
      this.stream = stream
      this.headers = headers
      this.params = params
      this.body = undefined
    }

    if (ParentRequest === undefined) {
      // Prevent users from decorating constructor properties
      Object.assign(Request.prototype, new Request(null, null, null))
      Request.prototype._trustProxy = trustProxy
      // eslint-disable-next-line no-use-before-define
      defineProperties(Request.prototype, RequestPrototype)
    } else {
      Request.prototype = Object.create(ParentRequest.prototype)
    }

    return Request
  },
}

const RequestPrototype = {
  host: {
    get() {
      return this._trustProxy && this.headers['x-forwarded-host'] || this.headers.host
    },
  },

  method: {
    get() {
      return this.stream.method
    },
  },

  _query: null,
  query: {
    get() {
      if (this._query === null) {
        this._query = querystringParse(this.querystring)
      }
      return this._query
    },
    set(value) {
      this._query = value
    },
  },

  querystring: {
    get() {
      const {url} = this.stream
      const qIndex = url.indexOf('?')
      return qIndex === -1 ? '' : url.slice(qIndex + 1)
    },
  },

  url: {
    get() {
      return this.stream.url
    },
  },
}
