'use strict'

const runHooks = require('./HookRunners').onRequestPreHandlerHookRunner

function routeHandler(req, res, params, routeContext) {
  var request = new routeContext.Request(req, req.headers, params)
  var response = new routeContext.Response(res, request, routeContext)

  if (routeContext.onFinished !== null) {
    var onFinishedContext = {response, listener: null}
    var listener = runOnFinishedHooks.bind(onFinishedContext)
    onFinishedContext.listener = listener
    res.on('finish', listener)
    res.on('close', listener)
  }

  if (routeContext.onRequest === null) {
    routeContext.methodHandler(response)
  } else {
    runHooks(routeContext.onRequest, response, routeContext.methodHandler)
  }
}

function runOnFinishedHooks() {
  const {response, listener} = this
  const onFinishedHooks = response.route.onFinished

  response.route = null // Reduce memory

  response.res
    .removeListener('finish', listener)
    .removeListener('close', listener)

  for (var i = 0; i < onFinishedHooks.length; i++) {
    onFinishedHooks[i](response.request, response)
  }
}

const methodHandlers = {
  GET: runPreHandlerHooks,
  HEAD: runPreHandlerHooks,
  POST: handlePostPutPatch,
  PUT: handlePostPutPatch,
  PATCH: handlePostPutPatch,
  OPTIONS: handleOptionsDelete,
  DELETE: handleOptionsDelete,
}

/**
 * Determine when to parse a body based on RFC 7230:
 * https://tools.ietf.org/html/rfc7230#section-3.3
 */

function handlePostPutPatch(response) {
  var {request, route} = response
  var {headers} = request

  if (headers['transfer-encoding'] !== undefined) {
    route.bodyParser.run(headers['content-type'], -1, request, response, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if ((contentLength >= 0) === false) {
      response.error(400, new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  if (headers['content-type'] === undefined && contentLength === 0) {
    runPreHandlerHooks(response)
  } else {
    route.bodyParser
      .run(headers['content-type'], contentLength, request, response, runPreHandlerHooks)
  }
}

/**
 * Following https://tools.ietf.org/html/rfc7231#section-4.3.7, only
 * parse the body of an OPTIONS request if it has a Content-Type.
 * Sometimes it's helpful to send a body with a DELETE request,
 * so treat it the same as an OPTIONS request.
 */
function handleOptionsDelete(response) {
  var {request} = response
  var {headers} = request
  var contentType = headers['content-type']

  if (contentType === undefined) {
    runPreHandlerHooks(response)
    return
  }

  var {route} = response

  if (headers['transfer-encoding'] !== undefined) {
    route.bodyParser.run(contentType, -1, request, response, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if ((contentLength >= 0) === false) {
      response.error(400, new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  route.bodyParser.run(contentType, contentLength, request, response, runPreHandlerHooks)
}

function runPreHandlerHooks(response) {
  if (response.route.preHandler === null) {
    runHandler(response)
  } else {
    runHooks(response.route.preHandler, response, runHandler)
  }
}

function runHandler(response) {
  var result = response.route.handler(response.request, response)
  if (result && typeof result.then === 'function') {
    result
      .then((payload) => {
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

function defaultNotFoundHandler(request, response) {
  response.status(404).send(`Not Found: ${request.method} ${request.url}`)
}

function notFoundFallbackHandler(req, res) {
  const payload = `Unsupported request method: ${req.method}`
  res.writeHead(501, { // Not Implemented
    'Content-Type': 'text/plain',
    'Content-Length': '' + Buffer.byteLength(payload),
  })
  res.end(payload)
}

module.exports = {
  routeHandler,
  methodHandlers,
  defaultNotFoundHandler,
  notFoundFallbackHandler,
}
