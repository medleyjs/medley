'use strict'

const compileJSONStringify = require('compile-json-stringify')
const {runOnRequestHooks, runOnErrorHooks} = require('./HookRunners')
const {STATUS_CODES} = require('http')

function createRequestHandler(router, notFoundRoute, Request, Response) {
  return function requestHandler(req, res) {
    var queryIndex = req.url.indexOf('?') // find-my-way needs the query string removed
    var url = queryIndex >= 0 ? req.url.slice(0, queryIndex) : req.url

    var route = router.find(req.method, url, undefined) || notFoundRoute

    var routeContext = route.store
    var request = new Request(req, req.headers, route.params)
    var response = new Response(res, request, routeContext)

    if (routeContext.onFinishedHooks !== null) {
      var onFinishedContext = {response, listener: null}
      var onFinished = runOnFinishedHooks.bind(onFinishedContext)

      onFinishedContext.listener = onFinished

      res.on('finish', onFinished)
      res.on('close', onFinished)
    }

    if (routeContext.onRequestHooks === null) {
      runHandler(response)
    } else {
      runOnRequestHooks(routeContext.onRequestHooks, request, response, runHandler)
    }
  }
}

function runOnFinishedHooks() {
  const {response, listener} = this
  const {onFinishedHooks} = response._route

  response.stream
    .removeListener('finish', listener)
    .removeListener('close', listener)

  for (var i = 0; i < onFinishedHooks.length; i++) {
    onFinishedHooks[i](response.request, response)
  }
}

function runHandler(res) {
  var result = res._route.handler(res.request, res)
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
        runOnErrorHooks(err, res)
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
  res.statusCode = 404
  res.send(`Not Found: ${req.method} ${req.url}`)
}

function defaultErrorHandler(err, req, res) {
  const statusCode = getErrorStatusCode(err)
  const body = buildErrorBody(err, statusCode)

  res.statusCode = statusCode
  res._headers['content-type'] = 'application/json'

  res.send(body)
}

function finalErrorHandler(err, res) {
  const statusCode = getErrorStatusCode(err)
  const body = buildErrorBody(err, statusCode)
  const headers = res._headers

  headers['content-type'] = 'application/json'
  headers['content-length'] = '' + Buffer.byteLength(body)

  res.stream.writeHead(statusCode, headers)
  res.stream.end(body)
}

function getErrorStatusCode(error) {
  if (typeof error === 'object' && error !== null) {
    const status = error.status || error.statusCode
    if (status >= 400 && status <= 599) {
      return status
    }
  }

  return 500
}

const serializeError = compileJSONStringify({
  type: 'object',
  properties: {
    error: {type: 'string'},
    message: {type: 'string'},
    statusCode: {type: 'number'},
  },
})

function buildErrorBody(err, statusCode) {
  return serializeError({
    error: STATUS_CODES[statusCode] || `${statusCode} Error`,
    message: statusCode >= 500 && statusCode <= 599 && process.env.NODE_ENV === 'production'
      ? '5xx Error'
      : err && err.message || '',
    statusCode,
  })
}

module.exports = {
  createRequestHandler,
  createOptionsHandler,
  create405Handler,
  defaultNotFoundHandler,
  defaultErrorHandler,
  finalErrorHandler,
}
