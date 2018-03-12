'use strict'

const defineProperties = require('./utils/defineProperties')
const destroyStream = require('destroy')
const eos = require('end-of-stream')
const statusCodes = require('http').STATUS_CODES
const flatstr = require('flatstr')
const compileJSONStringify = require('compile-json-stringify')
const runHooks = require('./HookRunners').onSendHookRunner

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
      this._request = request
      this._context = context
      this.sent = false
      this._customError = false
      this._ranHooks = false
    }

    if (ParentResponse === undefined) {
      // Prevent users from decorating constructor properties
      Object.assign(Response.prototype, {
        res: null,
        _request: null,
        _context: null,
        sent: false,
        _customError: false,
        _ranHooks: false,
      })
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

  code(code) {
    this.res.statusCode = code
    return this
  },

  getHeader(name) {
    return this.res.getHeader(name)
  },

  setHeader(name, value) {
    this.res.setHeader(name, value)
    return this
  },

  appendHeader(name, val) {
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

  removeHeader(name) {
    this.res.removeHeader(name)
    return this
  },

  type(contentType) {
    this.res.setHeader('Content-Type', contentType)
    return this
  },

  redirect(code, url) {
    if (url === undefined) {
      url = code
      code = 302
    }

    this.res.statusCode = code
    this.res.setHeader('Location', url)
    this.send()
  },

  error(err) {
    if (this.sent) {
      throw new Error('Cannot call response.error() when a response has already been sent')
    }

    handleError(this, err)
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
        this.res.setHeader('Content-Type', 'text/plain')
      } else if (
        payload !== null && (Buffer.isBuffer(payload) || typeof payload.pipe === 'function')
      ) {
        this.res.setHeader('Content-Type', 'application/octet-stream')
      } else {
        this.res.setHeader('Content-Type', 'application/json')
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
    onSendEnd(response, payload)
  } else {
    response._ranHooks = true
    runHooks(
      response._context.onSend,
      response,
      payload,
      wrapOnSendEnd
    )
  }
}

function wrapOnSendEnd(err, response, payload) {
  if (err) {
    response.res.statusCode = 500
    handleError(response, err)
  } else {
    onSendEnd(response, payload)
  }
}

function onSendEnd(response, payload) {
  if (response._request.body !== undefined) {
    response._request.body = undefined
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
    res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
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
      handleError(response, err)
    }
  })

  eos(res, (err) => {
    if (err && sourceOpen) {
      destroyStream(payload)
    }
  })

  payload.pipe(res)
}

function handleError(response, error) {
  var statusCode = response.res.statusCode
  statusCode = (statusCode >= 400) ? statusCode : 500
  if (error != null) {
    if (error.status >= 400) {
      if (error.status === 404) {
        notFound(response)
        return
      }
      statusCode = error.status
    } else if (error.statusCode >= 400) {
      if (error.statusCode === 404) {
        notFound(response)
        return
      }
      statusCode = error.statusCode
    }
  }

  response.res.statusCode = statusCode

  var customErrorHandler = response._context.errorHandler
  if (customErrorHandler !== null && response._customError === false) {
    response.sent = false
    response._customError = true

    if (response.res.getHeader('content-type') !== undefined) {
      response.res.removeHeader('content-type')
    }

    var result = customErrorHandler(error, response._request, response)
    if (result && typeof result.then === 'function') {
      result.then(
        response.send.bind(response),
        response.error.bind(response)
      )
    }
    return
  }

  response.sent = true

  var payload = serializeError({
    error: statusCodes[statusCode + ''],
    message: error && error.message || '',
    statusCode,
  })
  flatstr(payload)
  response.res.setHeader('Content-Type', 'application/json')

  if (response._ranHooks === false && response._context.onSend !== null) {
    runOnSendHooks(response, payload)
    return
  }

  response.res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
  response.res.end(payload)
}

function notFound(response) {
  response.sent = false

  if (response._context.notFoundContext === null) {
    // Not-found handler invoked inside a not-found handler
    response.code(404).type('text/plain').send('404 Not Found')
    return
  }

  if (response.res.getHeader('content-type') !== undefined) {
    response.res.removeHeader('content-type')
  }

  response._context = response._context.notFoundContext
  response._context.handler(response._request, response)
}
