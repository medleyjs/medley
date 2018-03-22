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
}

module.exports = RouteContext
