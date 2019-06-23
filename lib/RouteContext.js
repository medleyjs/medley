'use strict'

const RouteContext = {
  create(app, jsonSerializers, handler, config) {
    return {
      jsonSerializers,
      handler,
      config,
      onStreamError: app._onStreamError,
      onRequestHooks: null,
      onSendHooks: null,
      onFinishedHooks: null,
      errorHandler: null,
    }
  },

  setHooks(routeContext, hooks, routePreHandler) {
    const onRequestHooks = routePreHandler
      ? hooks.onRequest.concat(routePreHandler)
      : hooks.onRequest

    routeContext.onRequestHooks = onRequestHooks.length ? onRequestHooks : null
    routeContext.onSendHooks = hooks.onSend.length ? hooks.onSend : null
    routeContext.onFinishedHooks = hooks.onFinished.length ? hooks.onFinished : null
  },
}

module.exports = RouteContext
