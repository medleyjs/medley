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
      this.sent = false
      this.headers = Object.create(null)
      this.state = {}
      this._route = routeContext
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

    get config() {
      return this._route.config
    }

    status(statusCode) {
      this.stream.statusCode = statusCode
      return this
    }

    getHeader(name) {
      return this.headers[name.toLowerCase()]
    }

    setHeader(header, value) {
      if (typeof header === 'string') {
        if (value === undefined) {
          throw new TypeError("Cannot set header value to 'undefined'")
        }
        this.headers[header.toLowerCase()] = value
        return this
      }

      for (const name in header) {
        if (header[name] === undefined) {
          throw new TypeError("Cannot set header value to 'undefined'")
        }
        this.headers[name.toLowerCase()] = header[name]
      }
      return this
    }

    appendHeader(name, value) {
      if (value === undefined) {
        throw new TypeError("Cannot set header value to 'undefined'")
      }

      name = name.toLowerCase()
      const curVal = this.headers[name]

      if (curVal !== undefined) {
        if (typeof curVal === 'string') {
          value = typeof value === 'string' ? [curVal, value] : [curVal].concat(value)
        } else {
          value = curVal.concat(value)
        }
      }

      this.headers[name] = value

      return this
    }

    hasHeader(name) {
      return this.headers[name.toLowerCase()] !== undefined
    }

    removeHeader(name) {
      delete this.headers[name.toLowerCase()]
      return this
    }

    type(contentType) {
      if (contentType === undefined) {
        throw new TypeError("Cannot set header value to 'undefined'")
      }
      this.headers['content-type'] = contentType
      return this
    }

    redirect(code, url) {
      if (url === undefined) {
        url = code
        code = 302
      }

      this.statusCode = code
      this.headers.location = url
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

    send(body) {
      if (this.sent) {
        throw new Error('Cannot call .send() when a response has already been sent')
      }

      this.sent = true

      if (body !== undefined && body !== null) {
        if (this.headers['content-type'] === undefined) {
          if (typeof body === 'string') {
            this.headers['content-type'] = 'text/plain; charset=utf-8'
          } else if (body instanceof Buffer || typeof body.pipe === 'function') {
            this.headers['content-type'] = 'application/octet-stream'
          } else {
            this.headers['content-type'] = 'application/json'
            body = serialize(this._route, body, this.stream.statusCode)
          }
        } else if (
          typeof body !== 'string' &&
          !(body instanceof Buffer) &&
          typeof body.pipe !== 'function'
        ) {
          body = serialize(this._route, body, this.stream.statusCode)
        }
      }

      if (this._route.onSendHooks === null) {
        sendFinalResponse(this, body)
      } else {
        runOnSendHooks(this, body, sendFinalResponse)
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

  // Prevent users from overwriting constructor properties with `app.extendResponse()`
  Object.assign(Response.prototype, new Response(null, null, null))

  return Response
}

function sendFinalResponse(res, body) {
  var {headers} = res
  var resStream = res.stream
  var req = res.request
  var isHead = req.stream.method === 'HEAD'

  req.body = undefined

  if (body === undefined || body === null) {
    if (resStream.statusCode !== 204 && resStream.statusCode !== 304 && !isHead) {
      headers['content-length'] = '0'
    }
  } else if (typeof body === 'string') {
    headers['content-length'] = '' + Buffer.byteLength(body)
  } else if (body instanceof Buffer) {
    headers['content-length'] = '' + body.length
  } else if (typeof body.pipe === 'function') {
    if (!isHead) {
      sendStream(body, resStream, res)
      return
    }
    destroyStream(body)
  } else {
    const error = new TypeError(
      `Attempted to send body of invalid type '${typeof body}'. Expected a string, Buffer, or stream.`
    )
    res._route.onErrorSending(error)
    finalErrorHandler(error, res)
    return
  }

  resStream.writeHead(resStream.statusCode, headers)
  resStream.end(isHead ? undefined : body)
}

function sendStream(bodyStream, resStream, res) {
  var bodyStreamOpen = true
  var resOpen = true

  eos(bodyStream, {readable: true, writable: false}, (err) => {
    bodyStreamOpen = false
    if (!err || !resOpen) {
      return
    }

    res._route.onErrorSending(err)

    if (resStream.headersSent) {
      resStream.destroy(err)
    } else {
      finalErrorHandler(err, res)
    }
  })

  eos(resStream, (err) => {
    resOpen = false
    if (err && bodyStreamOpen) {
      res._route.onErrorSending(err)
      destroyStream(bodyStream)
    }
  })

  // Must use implicit headers when piping to the response stream
  // in case the body stream errors before headers are sent
  for (const name in res.headers) {
    resStream.setHeader(name, res.headers[name])
  }

  bodyStream.pipe(resStream)
}

module.exports = {
  buildResponse,
}
