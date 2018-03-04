'use strict'

const runHooks = require('./hookRunner').hookRunner

function handleRequest(reply, context) {
  var {request} = reply
  var {method, headers} = request.req

  if (method === 'GET' || method === 'HEAD') {
    runPreHandlerHooks(reply)
    return
  }

  var contentType = headers['content-type']

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    if (contentType === undefined) {
      if (
        headers['transfer-encoding'] === undefined &&
        (headers['content-length'] === '0' || headers['content-length'] === undefined)
      ) { // Request has no body to parse
        runPreHandlerHooks(reply)
      } else {
        context.contentTypeParser.run('', runPreHandlerHooks, request, reply)
      }
    } else {
      context.contentTypeParser.run(contentType, runPreHandlerHooks, request, reply)
    }
    return
  }

  if (method === 'OPTIONS' || method === 'DELETE') {
    if (contentType === undefined) {
      runPreHandlerHooks(reply)
    } else {
      context.contentTypeParser.run(contentType, runPreHandlerHooks, request, reply)
    }
    return
  }

  reply.code(405).send(new Error('Method Not Allowed: ' + method))
}

function runPreHandlerHooks(reply) {
  if (reply.context.preHandler === null) {
    preHandlerCallback(null, reply)
  } else {
    runHooks(
      reply.context.preHandler,
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
    reply.send(err)
    return
  }

  var result = reply.context.handler(reply.request, reply)
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
        reply._isError = true
        reply.send(err)
      })
  }
}

module.exports = handleRequest
