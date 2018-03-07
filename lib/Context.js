'use strict'

const Context = {
  create(app, jsonSerializers, handler, config, bodyLimit) {
    return {
      jsonSerializers,
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
      onResponse: null,
      notFoundContext: null,
    }
  },
}

module.exports = Context
