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
    function Response(res, request, context) {
      this.res = res
      this.request = request
      this._context = context
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
  config: {
    get() {
      return this._context.config
    },
  },

  status(statusCode) {
    this.res.statusCode = statusCode
    return this
  },

  get(name) {
    return this.res.getHeader(name)
  },

  set(name, value) {
    this.res.setHeader(name, value)
    return this
  },

  append(name, val) {
    const curVal = this.res.getHeader(name)

    if (curVal === undefined) {
      this.res.setHeader(name, val)
    } else if (typeof curVal === 'string') {
      this.res.setHeader(
        name,
        typeof val === 'string' ? [curVal, val] : [curVal].concat(val)
      )
    } else {
      this.res.setHeader(name, curVal.concat(val))
    }

    return this
  },

  remove(name) {
    this.res.removeHeader(name)
    return this
  },

  type(contentType) {
    this.res.setHeader('content-type', contentType)
    return this
  },

  redirect(code, url) {
    if (url === undefined) {
      url = code
      code = 302
    }

    this.res.statusCode = code
    this.res.setHeader('location', url)
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

    var {res} = this
    res.statusCode = statusCode

    var customErrorHandler = this._context.errorHandler
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

    var contentType = this.res.getHeader('content-type') // Using var for perf

    if (contentType === undefined) {
      if (typeof payload === 'string') {
        this.res.setHeader('content-type', 'text/plain')
      } else if (
        payload !== null && (Buffer.isBuffer(payload) || typeof payload.pipe === 'function')
      ) {
        this.res.setHeader('content-type', 'application/octet-stream')
      } else {
        this.res.setHeader('content-type', 'application/json')
        payload = serialize(this._context, payload, this.res.statusCode)
      }
    } else if (
      contentType === 'application/json' &&
      (payload === null || (!Buffer.isBuffer(payload) && typeof payload.pipe !== 'function'))
    ) {
      payload = serialize(this._context, payload, this.res.statusCode)
    }

    runOnSendHooks(this, payload)
  },
}

function runOnSendHooks(response, payload) {
  if (response._context.onSend === null || response._ranHooks) {
    sendFinalPayload(response, payload)
  } else {
    response._ranHooks = true
    runHooks(
      response._context.onSend,
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

  var {res} = response

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

function sendStream(payload, res, response) {
  var sourceOpen = true

  eos(payload, {readable: true, writable: false}, (err) => {
    sourceOpen = false
    if (!err) {
      return
    }

    if (res.headersSent) {
      res.destroy(err)
    } else {
      response.sent = false
      response.error(err)
    }
  })

  eos(res, (err) => {
    if (err && sourceOpen) {
      destroyStream(payload)
    }
  })

  payload.pipe(res)
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
  response.res.removeHeader('content-type')

  var {notFoundContext} = response._context
  if (notFoundContext === null) {
    // Not-found handler invoked inside a not-found handler, so call the default
    defaultNotFoundHandler(response.request, response)
    return
  }

  response._context = notFoundContext // Replace the context before calling the not-found handler
  var result = notFoundContext.handler(response.request, response)

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
