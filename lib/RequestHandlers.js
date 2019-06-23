'use strict'

const runHooks = require('./HookRunners').onRequestHookRunner

function createRequestHandler(router, notFoundRouter, Request, Response) {
  return function requestHandler(req, res) {
    var queryIndex = req.url.indexOf('?') // find-my-way needs the query string removed
    var url = queryIndex >= 0 ? req.url.slice(0, queryIndex) : req.url

    var route = router.find(req.method, url, undefined) // Avoid arguments adaptor trampoline

    if (route === null) {
      route = notFoundRouter.find(req.method, url, undefined)

      if (route === null) {
        notFoundFallbackHandler(req, res)
        return
      }
    }

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
      runHooks(routeContext.onRequestHooks, response, runHandler)
    }
  }
}

function runOnFinishedHooks() {
  const {response, listener} = this
  const {onFinishedHooks} = response.route

  response.stream
    .removeListener('finish', listener)
    .removeListener('close', listener)

  for (var i = 0; i < onFinishedHooks.length; i++) {
    onFinishedHooks[i](response.request, response)
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
  createRequestHandler,
  createOptionsHandler,
  create405Handler,
  defaultNotFoundHandler,
}
