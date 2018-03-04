'use strict'

const urlUtil = require('url')
const runHooks = require('./hookRunner').hookRunner

function handleRequest(req, res, params, context) {
  var method = req.method
  var headers = req.headers
  var request = new context.Request(params, req, urlUtil.parse(req.url, true).query, headers)
  var reply = new context.Reply(res, context, request)

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
  if (reply.res.finished === true) {
    return undefined
  }
  return fn(reply.request, reply, next)
}

function preHandlerCallback(err, reply) {
  if (reply.res.finished === true) {
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
