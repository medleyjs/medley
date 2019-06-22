'use strict'

const RouteContext = {
  create(app, jsonSerializers, handler, config) {
    return {
      jsonSerializers,
      handler,
      config,
      Response: app._Response,
      Request: app._Request,
      onStreamError: app._onStreamError,
      onRequestHooks: null,
      preHandlerHooks: null,
      onSendHooks: null,
      onFinishedHooks: null,
      errorHandler: null,
    }
  },

  setHooks(routeContext, hooks, routePreHandler) {
    const preHandlerHooks = routePreHandler
      ? hooks.preHandler.concat(routePreHandler)
      : hooks.preHandler

    routeContext.onRequestHooks = hooks.onRequest.length ? hooks.onRequest : null
    routeContext.preHandlerHooks = preHandlerHooks.length ? preHandlerHooks : null
    routeContext.onSendHooks = hooks.onSend.length ? hooks.onSend : null
    routeContext.onFinishedHooks = hooks.onFinished.length ? hooks.onFinished : null
  },
}

module.exports = RouteContext
