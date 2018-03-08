'use strict'

const runHooks = require('./hookRunner')

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

function handlePostPutPatch(reply, context) {
  var {request} = reply
  var {headers} = request

  if (headers['transfer-encoding'] !== undefined) {
    context.bodyParser.run(headers['content-type'], runPreHandlerHooks, request, reply)
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
    context.bodyParser.run(headers['content-type'], runPreHandlerHooks, request, reply)
  }
}

/**
 * Following https://tools.ietf.org/html/rfc7231#section-4.3.7, only
 * parse the body of an OPTIONS request if it has a Content-Type.
 * Sometimes it's helpful to send a body with a DELETE request,
 * so treat it the same as an OPTIONS request.
 */
function handleOptionsDelete(reply, context) {
  var {request} = reply
  var {headers} = request

  if (headers['content-type'] === undefined) {
    runPreHandlerHooks(reply, context)
    return
  }

  if (headers['transfer-encoding'] !== undefined) {
    context.bodyParser.run(headers['content-type'], runPreHandlerHooks, request, reply)
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

  context.bodyParser.run(headers['content-type'], runPreHandlerHooks, request, reply)
}

function runPreHandlerHooks(reply, context) {
  if (context.preHandler === null) {
    runHandler(reply, context)
  } else {
    runHooks(
      context.preHandler,
      hookIterator,
      reply,
      preHandlerCallback
    )
  }
}

function hookIterator(fn, reply, next) {
  return reply.res.finished ? undefined : fn(reply.request, reply, next)
}

function preHandlerCallback(err, reply) {
  if (reply.res.finished) {
    return
  }
  if (err) {
    reply.error(err)
  } else {
    runHandler(reply, reply._context)
  }
}

function runHandler(reply, context) {
  var result = context.handler(reply.request, reply)
  if (result && typeof result.then === 'function') {
    result
      .then((payload) => {
        // this is for async functions that
        // are using reply.send directly
        if (payload !== undefined || (reply.res.statusCode === 204 && !reply.sent)) {
          reply.send(payload)
        }
      }, (err) => {
        reply.sent = false
        reply.error(err)
      })
  }
}

module.exports = {
  methodHandlers,
}
