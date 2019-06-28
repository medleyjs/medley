'use strict'

const RouteContext = {
  create(jsonSerializers, handler, config, preHandlerHooks, hooks, onErrorSending) {
    const onRequestHooks = preHandlerHooks
      ? hooks.onRequest.concat(preHandlerHooks)
      : hooks.onRequest

    return {
      jsonSerializers,
      handler,
      config,
      onErrorSending,
      preHandlerHooks,
      onRequestHooks: onRequestHooks.length ? onRequestHooks : null,
      onSendHooks: hooks.onSend.length ? hooks.onSend : null,
      onFinishedHooks: hooks.onFinished.length ? hooks.onFinished : null,
      onErrorHooks: hooks.onError,
    }
  },

  updateHooks(routeContext, hooks) {
    if (hooks.onRequest.length > 0) {
      if (routeContext.onRequestHooks === null) {
        routeContext.onRequestHooks = hooks.onRequest
      } else if (routeContext.preHandlerHooks) {
        routeContext.onRequestHooks = hooks.onRequest.concat(routeContext.preHandlerHooks)
      }
    }

    if (routeContext.onSendHooks === null && hooks.onSend.length > 0) {
      routeContext.onSendHooks = hooks.onSend
    }

    if (routeContext.onFinishedHooks === null && hooks.onFinished.length > 0) {
      routeContext.onFinishedHooks = hooks.onFinished
    }
  },
}

module.exports = RouteContext
