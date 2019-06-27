'use strict'

const RouteContext = {
  create(jsonSerializers, handler, config, onErrorSending) {
    return {
      jsonSerializers,
      handler,
      config,
      onErrorSending,
      onRequestHooks: null,
      onSendHooks: null,
      onFinishedHooks: null,
      onErrorHooks: null,
    }
  },

  setHooks(routeContext, hooks, routePreHandler) {
    const onRequestHooks = routePreHandler
      ? hooks.onRequest.concat(routePreHandler)
      : hooks.onRequest

    routeContext.onRequestHooks = onRequestHooks.length ? onRequestHooks : null
    routeContext.onSendHooks = hooks.onSend.length ? hooks.onSend : null
    routeContext.onFinishedHooks = hooks.onFinished.length ? hooks.onFinished : null
    routeContext.onErrorHooks = hooks.onError
  },
}

module.exports = RouteContext
