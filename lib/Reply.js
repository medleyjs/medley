'use strict'

const eos = require('end-of-stream')
const statusCodes = require('http').STATUS_CODES
const flatstr = require('flatstr')
const compileJSONStringify = require('compile-json-stringify')
const runHooks = require('./hookRunner')

const {serialize} = require('./Serializer')

const serializeError = compileJSONStringify({
  type: 'object',
  properties: {
    statusCode: {type: 'number'},
    error: {type: 'string'},
    message: {type: 'string'},
  },
})

function Reply(res, request, context) {
  this.res = res
  this.request = request
  this.context = context
  this.sent = false
  this._customError = false
  this.payload = undefined
}

Reply.buildReply = function(ParentReply) {
  function _Reply(res, request, context) {
    this.res = res
    this.request = request
    this.context = context
    this.sent = false
    this._customError = false
    this.payload = undefined
  }

  _Reply.prototype = new ParentReply()
  _Reply.prototype.constructor = _Reply

  return _Reply
}

Reply.prototype.code = function(code) {
  this.res.statusCode = code
  return this
}

Reply.prototype.header = function(key, value) {
  this.res.setHeader(key, value)
  return this
}

Reply.prototype.type = function(type) {
  this.res.setHeader('Content-Type', type)
  return this
}

Reply.prototype.redirect = function(code, url) {
  if (url === undefined) {
    url = code
    code = 302
  }

  this.res.statusCode = code
  this.res.setHeader('Location', url)
  this.send()
}

Reply.prototype.error = function(err) {
  if (this.sent) {
    // this.res.log.warn(new Error('Reply already sent'))
    return
  }

  this.sent = true
  handleError(this, err, true)
}

Reply.prototype.send = function(payload) {
  if (this.sent) {
    // this.res.log.warn(new Error('Reply already sent'))
    return
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
      payload = serialize(this.context, payload, this.res.statusCode)
    }
  } else if (
    contentType === 'application/json' &&
    (payload === null || (!Buffer.isBuffer(payload) && typeof payload.pipe !== 'function'))
  ) {
    payload = serialize(this.context, payload, this.res.statusCode)
  }

  runOnSendHooks(this, payload)
}

function runOnSendHooks(reply, payload) {
  if (reply.context.onSend === null) {
    onSendEnd(reply, payload)
  } else {
    reply.payload = payload
    runHooks(
      reply.context.onSend,
      hookIterator,
      reply,
      wrapOnSendEnd
    )
  }
}

function hookIterator(fn, reply, next) {
  return fn(reply.request, reply, next)
}

function wrapOnSendEnd(err, reply) {
  if (err) {
    handleError(reply, err, false)
  } else {
    onSendEnd(reply, reply.payload)
  }
}

function onSendEnd(reply, payload) {
  if (payload === undefined || payload === null) {
    reply.sent = true
    reply.res.end()
    return
  }

  if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) {
    if (typeof payload.pipe === 'function') {
      sendStream(payload, reply.res, reply)
      return
    }

    throw new TypeError(`Attempted to send payload of invalid type '${
      typeof payload
    }'. Expected a string, Buffer, or stream.`)
  }

  if (!reply.res.hasHeader('content-length')) {
    reply.res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
  }

  reply.sent = true
  reply.res.end(payload)
}

function sendStream(payload, res, reply) {
  var sourceOpen = true

  eos(payload, {readable: true, writable: false}, function(err) {
    sourceOpen = false
    if (!err) {
      return
    }

    if (res.headersSent) {
      // res.log.error(err, 'response terminated with an error with headers already sent')
      res.destroy()
    } else {
      handleError(reply, err, false)
    }
  })

  eos(res, function(err) {
    if (!err) {
      return
    }

    if (res.headersSent) {
      // res.log.error(err, 'response terminated with an error with headers already sent')
    }
    if (sourceOpen) {
      if (payload.destroy) {
        payload.destroy()
      } else if (typeof payload.close === 'function') {
        payload.close(noop)
      } else if (typeof payload.abort === 'function') {
        payload.abort()
      }
    }
  })

  payload.pipe(res)
}

function handleError(reply, error, shouldRunHooks) {
  var statusCode = reply.res.statusCode
  statusCode = (statusCode >= 400) ? statusCode : 500
  if (error != null) {
    if (error.status >= 400) {
      if (error.status === 404) {
        notFound(reply)
        return
      }
      statusCode = error.status
    } else if (error.statusCode >= 400) {
      if (error.statusCode === 404) {
        notFound(reply)
        return
      }
      statusCode = error.statusCode
    }
  }

  reply.res.statusCode = statusCode

  var customErrorHandler = reply.context.errorHandler
  if (customErrorHandler !== null && reply._customError === false) {
    reply.sent = false
    reply._customError = true
    var result = customErrorHandler(error, reply.request, reply)
    if (result && typeof result.then === 'function') {
      result.then(
        reply.send.bind(reply),
        reply.error.bind(reply)
      )
    }
    return
  }

  var payload = serializeError({
    error: statusCodes[statusCode + ''],
    message: error && error.message || '',
    statusCode,
  })
  flatstr(payload)
  reply.res.setHeader('Content-Type', 'application/json')

  if (shouldRunHooks) {
    runOnSendHooks(reply, payload)
    return
  }

  reply.res.setHeader('Content-Length', '' + Buffer.byteLength(payload))
  reply.sent = true
  reply.res.end(payload)
}

function notFound(reply) {
  reply.sent = false

  if (reply.context.notFoundContext === null) {
    // Not-found handler invoked inside a not-found handler
    reply.code(404).send('404 Not Found')
    return
  }

  reply.context = reply.context.notFoundContext
  reply.context.handler(reply.request, reply)
}

function noop() {}

module.exports = Reply
