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

function handlePostPutPatch(reply, context) {
  var {request} = reply
  var {headers} = request
  var contentType = headers['content-type']

  if (contentType === undefined) {
    if (
      headers['transfer-encoding'] === undefined &&
      (headers['content-length'] === '0' || headers['content-length'] === undefined)
    ) { // Request has no body to parse
      runPreHandlerHooks(reply, context)
    } else {
      context.bodyParser.run('', runPreHandlerHooks, request, reply)
    }
  } else {
    context.bodyParser.run(contentType, runPreHandlerHooks, request, reply)
  }
}

function handleOptionsDelete(reply, context) {
  var {request} = reply
  var {headers} = request
  var contentType = headers['content-type']

  if (contentType === undefined) {
    runPreHandlerHooks(reply, context)
  } else {
    context.bodyParser.run(contentType, runPreHandlerHooks, request, reply)
  }
}

function runPreHandlerHooks(reply, context) {
  if (context.preHandler === null) {
    preHandlerCallback(null, reply)
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
    return
  }

  var result = reply._context.handler(reply.request, reply)
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
