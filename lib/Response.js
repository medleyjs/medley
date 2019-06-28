'use strict'

const destroyStream = require('destroy')
const eos = require('end-of-stream')

const {finalErrorHandler} = require('./RequestHandlers')
const {runOnSendHooks, runOnErrorHooks} = require('./HookRunners')
const {serialize} = require('./Serializer')

function buildResponse() {
  class Response {
    constructor(stream, request, routeContext) {
      this.stream = stream
      this.request = request
      this.route = routeContext
      this.sent = false
      this.state = {}
      this._headers = {}
    }

    get headersSent() {
      return this.stream.headersSent
    }

    get statusCode() {
      return this.stream.statusCode
    }

    set statusCode(code) {
      this.stream.statusCode = code
    }

    status(statusCode) {
      this.stream.statusCode = statusCode
      return this
    }

    getHeader(field) {
      return this._headers[field.toLowerCase()]
    }

    setHeader(field, value) {
      if (typeof field === 'string') {
        if (value === undefined) {
          throw new TypeError("Cannot set header value to 'undefined'")
        }
        this._headers[field.toLowerCase()] = value
        return this
      }

      for (const name in field) {
        if (field[name] === undefined) {
          throw new TypeError("Cannot set header value to 'undefined'")
        }
        this._headers[name.toLowerCase()] = field[name]
      }
      return this
    }

    appendHeader(field, value) {
      if (value === undefined) {
        throw new TypeError("Cannot set header value to 'undefined'")
      }

      field = field.toLowerCase()
      const curVal = this._headers[field]

      if (curVal !== undefined) {
        if (typeof curVal === 'string') {
          value = typeof value === 'string' ? [curVal, value] : [curVal].concat(value)
        } else {
          value = curVal.concat(value)
        }
      }

      this._headers[field] = value

      return this
    }

    hasHeader(field) {
      return this._headers.hasOwnProperty(field.toLowerCase())
    }

    removeHeader(field) {
      delete this._headers[field.toLowerCase()]
      return this
    }

    type(contentType) {
      if (contentType === undefined) {
        throw new TypeError("Cannot set header value to 'undefined'")
      }
      this._headers['content-type'] = contentType
      return this
    }

    redirect(code, url) {
      if (url === undefined) {
        url = code
        code = 302
      }

      this.statusCode = code
      this._headers.location = url
      this.send()
    }

    error(statusCode, error) {
      if (this.sent) {
        throw new Error('Cannot call .error() when a response has already been sent')
      }

      if (error === undefined) {
        error = statusCode
      } else {
        error.status = statusCode
      }

      runOnErrorHooks(error, this)
    }

    send(payload) {
      if (this.sent) {
        throw new Error('Cannot call .send() when a response has already been sent')
      }

      this.sent = true

      if (payload !== undefined && payload !== null) {
        if (this._headers['content-type'] === undefined) {
          if (typeof payload === 'string') {
            this._headers['content-type'] = 'text/plain; charset=utf-8'
          } else if (payload instanceof Buffer || typeof payload.pipe === 'function') {
            this._headers['content-type'] = 'application/octet-stream'
          } else {
            this._headers['content-type'] = 'application/json'
            payload = serialize(this.route, payload, this.stream.statusCode)
          }
        } else if (
          typeof payload !== 'string' &&
          !(payload instanceof Buffer) &&
          typeof payload.pipe !== 'function'
        ) {
          payload = serialize(this.route, payload, this.stream.statusCode)
        }
      }

      if (this.route.onSendHooks === null) {
        sendFinalPayload(this, payload)
      } else {
        runOnSendHooks(this, payload, sendFinalPayload)
      }
    }
  }

  // Aliases
  Object.defineProperties(Response.prototype, {
    append: Object.getOwnPropertyDescriptor(Response.prototype, 'appendHeader'),
    get: Object.getOwnPropertyDescriptor(Response.prototype, 'getHeader'),
    has: Object.getOwnPropertyDescriptor(Response.prototype, 'hasHeader'),
    remove: Object.getOwnPropertyDescriptor(Response.prototype, 'removeHeader'),
    set: Object.getOwnPropertyDescriptor(Response.prototype, 'setHeader'),
  })

  // Prevent users from decorating constructor properties
  Object.assign(Response.prototype, new Response(null, null, null))

  return Response
}

function sendFinalPayload(res, payload) {
  var headers = res._headers
  var resStream = res.stream
  var req = res.request
  var isHead = req.stream.method === 'HEAD'

  req.body = undefined

  if (payload === undefined || payload === null) {
    if (resStream.statusCode !== 204 && resStream.statusCode !== 304 && !isHead) {
      headers['content-length'] = '0'
    }
  } else if (typeof payload === 'string') {
    headers['content-length'] = '' + Buffer.byteLength(payload)
  } else if (payload instanceof Buffer) {
    headers['content-length'] = '' + payload.length
  } else if (typeof payload.pipe === 'function') {
    if (!isHead) {
      sendStream(payload, resStream, res)
      return
    }
    destroyStream(payload)
  } else {
    const error = new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
    res.route.onErrorSending(error)
    finalErrorHandler(error, res)
    return
  }

  resStream.writeHead(resStream.statusCode, headers)
  resStream.end(isHead ? undefined : payload)
}

function sendStream(payload, resStream, res) {
  var payloadOpen = true
  var resOpen = true

  eos(payload, {readable: true, writable: false}, (err) => {
    payloadOpen = false
    if (!err || !resOpen) {
      return
    }

    res.route.onErrorSending(err)

    if (resStream.headersSent) {
      resStream.destroy(err)
    } else {
      finalErrorHandler(err, res)
    }
  })

  eos(resStream, (err) => {
    resOpen = false
    if (err && payloadOpen) {
      res.route.onErrorSending(err)
      destroyStream(payload)
    }
  })

  // Must use implicit headers when piping to the response stream
  // in case the payload stream errors before headers are sent
  for (const name in res._headers) {
    resStream.setHeader(name, res._headers[name])
  }

  payload.pipe(resStream)
}

module.exports = {
  buildResponse,
}
