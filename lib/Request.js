'use strict'

const querystringParse = require('querystring').parse

function buildRequest(trustProxy) {
  class Request {
    constructor(stream, headers, params) {
      this.stream = stream
      this.headers = headers
      this.params = params
      this.body = undefined
      this._query = null
    }

    get host() {
      return trustProxy && this.headers['x-forwarded-host'] || this.headers.host
    }

    get hostname() {
      const {host} = this
      if (!host) {
        return host
      }

      const portSearchStart = host[0] === '['
        ? host.indexOf(']', 1) // IPv6
        : 0
      const portStart = host.indexOf(':', portSearchStart)

      return portStart >= 0 ? host.slice(0, portStart) : host
    }

    get href() {
      return this.protocol + '://' + this.host + this.url
    }

    get method() {
      return this.stream.method
    }

    get origin() {
      return this.protocol + '://' + this.host
    }

    get path() {
      const {url} = this.stream
      const qsIndex = url.indexOf('?')

      return qsIndex >= 0 ? url.slice(0, qsIndex) : url
    }

    get protocol() {
      if (this.stream.socket.encrypted) {
        return 'https'
      }

      return trustProxy && this.headers['x-forwarded-proto'] || 'http'
    }

    get query() {
      if (this._query === null) {
        this._query = querystringParse(this.querystring)
      }

      return this._query
    }

    set query(value) {
      this._query = value
    }

    get querystring() {
      const {url} = this.stream
      const qsIndex = url.indexOf('?')

      return qsIndex >= 0 ? url.slice(qsIndex + 1) : ''
    }

    get search() {
      const {url} = this.stream
      const qsIndex = url.indexOf('?')

      return qsIndex >= 0 ? url.slice(qsIndex) : ''
    }

    get url() {
      return this.stream.url
    }
  }

  // Aliases
  Object.defineProperties(Request.prototype, {
    authority: Object.getOwnPropertyDescriptor(Request.prototype, 'host'),
    scheme: Object.getOwnPropertyDescriptor(Request.prototype, 'protocol'),
  })

  // Prevent users from decorating constructor properties
  Object.assign(Request.prototype, new Request(null, null, null))

  return Request
}

module.exports = {
  buildRequest,
}
