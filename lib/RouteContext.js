'use strict'

const RouteContext = {
  create(app, jsonSerializers, methodHandler, handler, config, bodyLimit) {
    return {
      jsonSerializers,
      methodHandler,
      handler,
      config,
      parserOptions: {
        limit: bodyLimit || null,
      },
      Response: app._Response,
      Request: app._Request,
      bodyParser: app._bodyParser,
      onRequestHooks: null,
      preHandlerHooks: null,
      onSendHooks: null,
      onFinishedHooks: null,
      notFoundRouteContext: null,
      errorHandler: null,
    }
  },

  setHooks(routeContext, hooks, beforeHandler) {
    const preHandlerHooks = beforeHandler
      ? hooks.preHandler.concat(beforeHandler)
      : hooks.preHandler

    routeContext.onRequestHooks = hooks.onRequest.length ? hooks.onRequest : null
    routeContext.preHandlerHooks = preHandlerHooks.length ? preHandlerHooks : null
    routeContext.onSendHooks = hooks.onSend.length ? hooks.onSend : null
    routeContext.onFinishedHooks = hooks.onFinished.length ? hooks.onFinished : null
  },
}

module.exports = RouteContext
