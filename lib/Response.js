'use strict'

const compileJSONStringify = require('compile-json-stringify')
const destroyStream = require('destroy')
const eos = require('end-of-stream')
const runHooks = require('./HookRunners').onSendHookRunner
const statusCodes = require('http').STATUS_CODES

const {serialize} = require('./Serializer')

const kRanCustomError = Symbol('ranCustomError')
const kRanOnSendHooks = Symbol('ranOnSendHooks')

const serializeError = compileJSONStringify({
  type: 'object',
  properties: {
    statusCode: {type: 'number'},
    error: {type: 'string'},
    message: {type: 'string'},
  },
})

function buildResponse() {
  class Response {
    constructor(stream, request, routeContext) {
      this.stream = stream
      this.request = request
      this.route = routeContext
      this.sent = false
      this.state = {}
      this._headers = {}
      this[kRanCustomError] = false
      this[kRanOnSendHooks] = false
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

    get(field) {
      return this._headers[field.toLowerCase()]
    }

    set(field, value) {
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

    append(field, value) {
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

    has(field) {
      return this._headers.hasOwnProperty(field.toLowerCase())
    }

    remove(field) {
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
        statusCode = getErrorStatus(error)
      }

      this.statusCode = statusCode

      var customErrorHandler = this.route.errorHandler
      if (customErrorHandler !== null && this[kRanCustomError] === false) {
        this[kRanCustomError] = true // Prevent the custom error handler from running again

        // Remove the current Content-Type so .send() doesn't assume the old type
        this.remove('content-type')

        var result = customErrorHandler(error, this.request, this)
        if (result && typeof result.then === 'function') {
          result.then((payload) => {
            if (payload !== undefined) {
              this.send(payload)
            }
          }, (err) => {
            if (this.sent) {
              throw err // Re-throw the error since it is a system error
            }
            this.error(err)
          })
        }
        return
      }

      this.sent = true

      var payload = serializeError({
        error: statusCodes['' + statusCode],
        message: getErrorMessage(error, statusCode),
        statusCode,
      })

      this._headers['content-type'] = 'application/json'

      runOnSendHooks(this, payload) // They won't run again if they already ran once
    }

    send(payload) {
      if (this.sent) {
        throw new Error('Cannot call .send() when a response has already been sent')
      }

      this.sent = true

      if (payload === undefined || payload === null) {
        runOnSendHooks(this, payload)
        return
      }

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

      runOnSendHooks(this, payload)
    }
  }

  // Aliases
  Object.defineProperties(Response.prototype, {
    appendHeader: Object.getOwnPropertyDescriptor(Response.prototype, 'append'),
    getHeader: Object.getOwnPropertyDescriptor(Response.prototype, 'get'),
    hasHeader: Object.getOwnPropertyDescriptor(Response.prototype, 'has'),
    removeHeader: Object.getOwnPropertyDescriptor(Response.prototype, 'remove'),
    setHeader: Object.getOwnPropertyDescriptor(Response.prototype, 'set'),
  })

  // Prevent users from decorating constructor properties
  Object.assign(Response.prototype, new Response(null, null, null))

  return Response
}

function runOnSendHooks(res, payload) {
  if (res.route.onSendHooks === null || res[kRanOnSendHooks]) {
    sendFinalPayload(res, payload)
  } else {
    res[kRanOnSendHooks] = true
    runHooks(
      res.route.onSendHooks,
      res,
      payload,
      sendFinalPayload
    )
  }
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
    throw new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
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

    if (resStream.headersSent) {
      res.route.onStreamError(err)
      resStream.destroy(err)
    } else {
      res.sent = false
      res.error(err)
    }
  })

  eos(resStream, (err) => {
    resOpen = false
    if (err && payloadOpen) {
      res.route.onStreamError(err)
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

function getErrorStatus(error) {
  if (typeof error === 'object' && error !== null) {
    const status = error.status || error.statusCode
    // HTTP/2 allowed values - https://github.com/nodejs/node/blob/ffd618bd5cde77e19ab6458eaf454c4df71dd638/lib/internal/http2/core.js#L1925
    if (status >= 200 && status <= 599) {
      return status
    }
  }

  return 500 // Internal Server Error
}

function getErrorMessage(error, statusCode) {
  if (statusCode >= 500 && statusCode <= 599 && process.env.NODE_ENV === 'production') {
    return '5xx Error'
  }

  return error && error.message || ''
}

module.exports = {
  buildResponse,
}
