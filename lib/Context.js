'use strict'

const Context = {
  create(app, jsonSerializers, methodHandler, handler, config, bodyLimit) {
    return {
      jsonSerializers,
      methodHandler,
      handler,
      config,
      parserOptions: {
        limit: bodyLimit || null,
      },
      Reply: app._Reply,
      Request: app._Request,
      bodyParser: app._bodyParser,
      errorHandler: app._errorHandler,
      onRequest: null,
      preHandler: null,
      onSend: null,
      onFinished: null,
      notFoundContext: null,
    }
  },
}

module.exports = Context
