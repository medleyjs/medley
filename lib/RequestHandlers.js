'use strict'

const http = require('http')

const runHooks = require('./HookRunners').onRequestPreHandlerHookRunner

function routeHandler(req, res, params, routeContext) {
  var request = new routeContext.Request(req, req.headers, params)
  var response = new routeContext.Response(res, request, routeContext)

  if (routeContext.onFinishedHooks !== null) {
    var onFinishedContext = {response, listener: null}
    var listener = runOnFinishedHooks.bind(onFinishedContext)
    onFinishedContext.listener = listener
    res.on('finish', listener)
    res.on('close', listener)
  }

  if (routeContext.onRequestHooks === null) {
    routeContext.methodHandler(response)
  } else {
    runHooks(routeContext.onRequestHooks, response, routeContext.methodHandler)
  }
}

function runOnFinishedHooks() {
  const {response, listener} = this
  const {onFinishedHooks} = response.route

  response.route = null // Reduce memory

  response.stream
    .removeListener('finish', listener)
    .removeListener('close', listener)

  for (var i = 0; i < onFinishedHooks.length; i++) {
    onFinishedHooks[i](response.request, response)
  }
}

const methodHandlers = {
  GET: runPreHandlerHooks,
  HEAD: runPreHandlerHooks,
  DELETE: runPreHandlerHooks,
  POST: handlePostPutPatch,
  PUT: handlePostPutPatch,
  PATCH: handlePostPutPatch,
  OPTIONS: handleOptions,
}

for (const method of http.METHODS) {
  if (!methodHandlers[method]) {
    methodHandlers[method] = runPreHandlerHooks
  }
}

/**
 * Determine when to parse a body based on RFC 7230:
 * https://tools.ietf.org/html/rfc7230#section-3.3
 */

function handlePostPutPatch(res) {
  var {request: req, route} = res
  var {headers} = req

  if (headers['transfer-encoding'] !== undefined) {
    route.bodyParser.run(headers['content-type'], req, res, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if (!(contentLength >= 0)) {
      res.error(400, new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  if (headers['content-type'] === undefined && contentLength === 0) {
    runPreHandlerHooks(res)
  } else {
    route.bodyParser.run(headers['content-type'], req, res, runPreHandlerHooks)
  }
}

/**
 * Following https://tools.ietf.org/html/rfc7231#section-4.3.7, only
 * parse the body of an OPTIONS request if it has a Content-Type.
 */
function handleOptions(res) {
  var req = res.request
  var {headers} = req
  var contentType = headers['content-type']

  if (contentType === undefined) {
    runPreHandlerHooks(res)
    return
  }

  var {route} = res

  if (headers['transfer-encoding'] !== undefined) {
    route.bodyParser.run(contentType, req, res, runPreHandlerHooks)
    return
  }

  var contentLength = headers['content-length']
  if (contentLength !== undefined && !(Number.parseInt(contentLength, 10) >= 0)) {
    res.error(400, new Error(`Invalid Content-Length: "${contentLength}"`))
    return
  }

  route.bodyParser.run(contentType, req, res, runPreHandlerHooks)
}

function runPreHandlerHooks(res) {
  if (res.route.preHandlerHooks === null) {
    runHandler(res)
  } else {
    runHooks(res.route.preHandlerHooks, res, runHandler)
  }
}

function runHandler(res) {
  var result = res.route.handler(res.request, res)
  if (result && typeof result.then === 'function') {
    result
      .then((payload) => {
        if (payload !== undefined) {
          res.send(payload)
        }
      }, (err) => {
        if (res.sent) {
          throw err // Re-throw the error since it is a system error
        }
        res.error(err)
      })
  }
}

function createOptionsHandler(allowedMethods) {
  return function autoOptionsHandler(req, res) {
    res.statusCode = 200
    res._headers.allow = allowedMethods
    res.send(allowedMethods)
  }
}

function create405Handler(allowedMethods) {
  return function auto405Handler(req, res) {
    res.statusCode = 405
    res._headers.allow = allowedMethods
    res.send(req.method === 'HEAD' ? null : `Method Not Allowed: ${req.method} ${req.url}`)
  }
}

function defaultNotFoundHandler(req, res) {
  res.status(404).send(`Not Found: ${req.method} ${req.url}`)
}

function notFoundFallbackHandler(req, res) { // Node's req/res
  const payload = `Unsupported request method: ${req.method}`
  res.writeHead(501, { // Not Implemented
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': '' + Buffer.byteLength(payload),
  })
  res.end(payload)
}

module.exports = {
  routeHandler,
  methodHandlers,
  createOptionsHandler,
  create405Handler,
  defaultNotFoundHandler,
  notFoundFallbackHandler,
}
