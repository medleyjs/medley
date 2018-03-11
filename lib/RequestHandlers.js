'use strict'

const runHooks = require('./HookRunners').onRequestPreHandlerHookRunner

function routeHandler(req, res, params, context) {
  var request = new context.Request(req, req.headers, params)
  var reply = new context.Reply(res, request, context)

  if (context.onFinished !== null) {
    var onFinishedContext = {reply, listener: null}
    var listener = runOnFinishedHooks.bind(onFinishedContext)
    onFinishedContext.listener = listener
    res.on('finish', listener)
    res.on('close', listener)
  }

  if (context.onRequest === null) {
    context.methodHandler(reply)
  } else {
    runHooks(context.onRequest, reply, context.methodHandler)
  }
}

function runOnFinishedHooks() {
  const {reply, listener} = this
  const onFinishedHooks = reply._context.onFinished

  reply._context = null // Reduce memory

  reply.res
    .removeListener('finish', listener)
    .removeListener('close', listener)

  for (var i = 0; i < onFinishedHooks.length; i++) {
    onFinishedHooks[i](reply._request, reply)
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

function handlePostPutPatch(reply) {
  var context = reply._context
  var request = reply._request
  var {headers} = request

  if (headers['transfer-encoding'] !== undefined) {
    context.bodyParser.run(headers['content-type'], -1, request, reply, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if ((contentLength >= 0) === false) {
      reply.code(400).error(new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  if (headers['content-type'] === undefined && contentLength === 0) {
    runPreHandlerHooks(reply, context)
  } else {
    context.bodyParser
      .run(headers['content-type'], contentLength, request, reply, runPreHandlerHooks)
  }
}

/**
 * Following https://tools.ietf.org/html/rfc7231#section-4.3.7, only
 * parse the body of an OPTIONS request if it has a Content-Type.
 * Sometimes it's helpful to send a body with a DELETE request,
 * so treat it the same as an OPTIONS request.
 */
function handleOptionsDelete(reply) {
  var context = reply._context
  var request = reply._request
  var {headers} = request

  if (headers['content-type'] === undefined) {
    runPreHandlerHooks(reply, context)
    return
  }

  if (headers['transfer-encoding'] !== undefined) {
    context.bodyParser.run(headers['content-type'], -1, request, reply, runPreHandlerHooks)
    return
  }

  var contentLength = 0

  if (headers['content-length'] !== undefined) {
    contentLength = Number.parseInt(headers['content-length'], 10)

    if ((contentLength >= 0) === false) {
      reply.code(400).error(new Error(`Invalid Content-Length: "${headers['content-length']}"`))
      return
    }
  }

  context.bodyParser.run(headers['content-type'], contentLength, request, reply, runPreHandlerHooks)
}

function runPreHandlerHooks(reply) {
  if (reply._context.preHandler === null) {
    runHandler(reply)
  } else {
    runHooks(reply._context.preHandler, reply, runHandler)
  }
}

function runHandler(reply) {
  var result = reply._context.handler(reply._request, reply)
  if (result && typeof result.then === 'function') {
    result
      .then((payload) => {
        if (payload !== undefined) {
          reply.send(payload)
        }
      }, (err) => {
        reply.sent = false
        reply.error(err)
      })
  }
}

function defaultNotFoundHandler(request, reply) {
  reply.code(404).send(`Not Found: ${request.method} ${request.url}`)
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
