'use strict'

const runHooks = require('./HookRunners').onRequestPreHandlerHookRunner

function createRequestHandler(router, notFoundRouter) {
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

    routeHandler(req, res, route.params, route.store)
  }
}

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
    runPreHandlerHooks(response)
  } else {
    runHooks(routeContext.onRequestHooks, response, runPreHandlerHooks)
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
  createRequestHandler,
  createOptionsHandler,
  create405Handler,
  defaultNotFoundHandler,
}
