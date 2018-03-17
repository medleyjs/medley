'use strict'

const defineProperties = require('./utils/defineProperties')
const destroyStream = require('destroy')
const eos = require('end-of-stream')
const statusCodes = require('http').STATUS_CODES
const flatstr = require('flatstr')
const compileJSONStringify = require('compile-json-stringify')
const runHooks = require('./HookRunners').onSendHookRunner

const {defaultNotFoundHandler} = require('./RequestHandlers')
const {serialize} = require('./Serializer')

const serializeError = compileJSONStringify({
  type: 'object',
  properties: {
    statusCode: {type: 'number'},
    error: {type: 'string'},
    message: {type: 'string'},
  },
})

module.exports = {
  buildResponse(ParentResponse) {
    function Response(stream, request, routeContext) {
      this.stream = stream
      this.request = request
      this.route = routeContext
      this.sent = false
      this._customError = false
      this._ranHooks = false
    }

    if (ParentResponse === undefined) {
      // Prevent users from decorating constructor properties
      Object.assign(Response.prototype, new Response(null, null, null))
      // eslint-disable-next-line no-use-before-define
      defineProperties(Response.prototype, ResponsePrototype)
    } else {
      Response.prototype = Object.create(ParentResponse.prototype)
    }

    return Response
  },
}

const ResponsePrototype = {
  statusCode: {
    get() {
      return this.stream.statusCode
    },
    set(code) {
      this.stream.statusCode = code
    },
  },

  status(statusCode) {
    this.stream.statusCode = statusCode
    return this
  },

  get(field) {
    return this.stream.getHeader(field)
  },

  set(field, value) {
    if (typeof field === 'string') {
      this.stream.setHeader(field, value)
      return this
    }

    const fields = Object.keys(field)
    for (var i = 0; i < fields.length; i++) {
      this.stream.setHeader(fields[i], field[fields[i]])
    }
    return this
  },

  append(field, value) {
    const curVal = this.stream.getHeader(field)

    if (curVal !== undefined) {
      if (typeof curVal === 'string') {
        value = typeof value === 'string' ? [curVal, value] : [curVal].concat(value)
      } else {
        value = curVal.concat(value)
      }
    }

    this.stream.setHeader(field, value)

    return this
  },

  remove(field) {
    this.stream.removeHeader(field)
    return this
  },

  type(contentType) {
    this.stream.setHeader('content-type', contentType)
    return this
  },

  redirect(code, url) {
    if (url === undefined) {
      url = code
      code = 302
    }

    this.statusCode = code
    this.stream.setHeader('location', url)
    this.send()
  },

  error(statusCode, error) {
    if (this.sent) {
      throw new Error('Cannot call response.error() when a response has already been sent')
    }

    if (error === undefined) {
      error = statusCode
      statusCode = getErrorStatus(error)
    }

    if (statusCode === 404) {
      handle404(this)
      return
    }

    var res = this.stream
    res.statusCode = statusCode

    var customErrorHandler = this.route.errorHandler
    if (customErrorHandler !== null && this._customError === false) {
      this._customError = true // Prevent the custom error handler from running again

      // Remove the current Content-Type so .send() doesn't assume the old type
      res.removeHeader('content-type')

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
      message: error && error.message || '',
      statusCode,
    })
    flatstr(payload)

    res.setHeader('content-type', 'application/json')
    res.setHeader('content-length', '' + Buffer.byteLength(payload))

    runOnSendHooks(this, payload) // They won't run again if they already ran once
  },

  send(payload) {
    if (this.sent) {
      throw new Error('Cannot call response.send() when a response has already been sent')
    }

    this.sent = true

    if (payload === undefined) {
      runOnSendHooks(this, payload)
      return
    }

    var contentType = this.stream.getHeader('content-type') // Using var for perf

    if (contentType === undefined) {
      if (typeof payload === 'string') {
        this.stream.setHeader('content-type', 'text/plain')
      } else if (
        payload !== null && (payload instanceof Buffer || typeof payload.pipe === 'function')
      ) {
        this.stream.setHeader('content-type', 'application/octet-stream')
      } else {
        this.stream.setHeader('content-type', 'application/json')
        payload = serialize(this.route, payload, this.stream.statusCode)
      }
    } else if (
      contentType === 'application/json' &&
      (payload === null || !(payload instanceof Buffer || typeof payload.pipe === 'function'))
    ) {
      payload = serialize(this.route, payload, this.stream.statusCode)
    }

    runOnSendHooks(this, payload)
  },
}

function runOnSendHooks(response, payload) {
  if (response.route.onSend === null || response._ranHooks) {
    sendFinalPayload(response, payload)
  } else {
    response._ranHooks = true
    runHooks(
      response.route.onSend,
      response,
      payload,
      sendFinalPayload
    )
  }
}

function sendFinalPayload(response, payload) {
  if (response.request.body !== undefined) {
    response.request.body = undefined
  }

  var res = response.stream

  if (payload === undefined || payload === null) {
    res.end()
    return
  }

  if (typeof payload !== 'string' && !(payload instanceof Buffer)) {
    if (typeof payload.pipe === 'function') {
      sendStream(payload, res, response)
      return
    }

    throw new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
  }

  if (res.getHeader('content-length') === undefined) {
    res.setHeader('content-length', '' + Buffer.byteLength(payload))
  }

  res.end(payload)
}

function sendStream(payload, resStream, response) {
  var sourceOpen = true

  eos(payload, {readable: true, writable: false}, (err) => {
    sourceOpen = false
    if (!err) {
      return
    }

    if (resStream.headersSent) {
      resStream.destroy(err)
    } else {
      response.sent = false
      response.error(err)
    }
  })

  eos(resStream, (err) => {
    if (err && sourceOpen) {
      destroyStream(payload)
    }
  })

  payload.pipe(resStream)
}

function getErrorStatus(error) {
  if (typeof error === 'object' && error !== null) {
    const status = error.status || error.statusCode
    // HTTP 2 allowed values - https://github.com/nodejs/node/blob/ffd618bd5cde77e19ab6458eaf454c4df71dd638/lib/internal/http2/core.js#L1925
    if (status >= 200 && status <= 599) {
      return status
    }
  }

  return 500 // Internal Server Error
}

function handle404(response) {
  response.sent = false

  // Remove the current Content-Type so .send() doesn't assume the old type
  response.stream.removeHeader('content-type')

  var {notFoundRouteContext} = response.route
  if (notFoundRouteContext === null) {
    // Not-found handler invoked inside a not-found handler, so call the default
    defaultNotFoundHandler(response.request, response)
    return
  }

  response.route = notFoundRouteContext // Replace the context before calling the handler
  var result = notFoundRouteContext.handler(response.request, response)

  if (result && typeof result.then === 'function') {
    result.then((payload) => {
      if (payload !== undefined) {
        response.send(payload)
      }
    }, (err) => {
      if (response.sent) {
        throw err // Re-throw the error since it is a system error
      }
      response.error(err)
    })
  }
}

// Aliases
ResponsePrototype.appendHeader = ResponsePrototype.append
ResponsePrototype.getHeader = ResponsePrototype.get
ResponsePrototype.removeHeader = ResponsePrototype.remove
ResponsePrototype.setHeader = ResponsePrototype.set
