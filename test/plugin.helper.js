'use strict'

const fp = require('fastify-plugin')

module.exports = fp(function(app, opts, next) {
  app.decorate('test', () => {})
  next()
})
