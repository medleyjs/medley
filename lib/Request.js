'use strict'

const defineProperties = require('./utils/defineProperties')
const querystringParse = require('querystring').parse

module.exports = {
  buildRequest(ParentRequest) {
    function Request(req, headers, params) {
      this.req = req
      this.headers = headers
      this.params = params
      this.body = undefined
      this._query = null
    }

    if (ParentRequest === undefined) {
      // Prevent users from decorating constructor properties
      Object.assign(Request.prototype, {
        req: null,
        headers: null,
        params: null,
        body: undefined,
        _query: null,
      })
      // eslint-disable-next-line no-use-before-define
      defineProperties(Request.prototype, RequestPrototype)
    } else {
      Request.prototype = Object.create(ParentRequest.prototype)
    }

    return Request
  },
}

const RequestPrototype = {
  method: {
    get() {
      return this.req.method
    },
  },

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
}
