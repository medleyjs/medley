'use strict'

const app = require('../fastify')()

app
  .addHook('onRequest', (req, res, next) => {
    next()
  })
  .addHook('onRequest', (req, res, next) => {
    next()
  })

app
  .addHook('preHandler', (request, reply, next) => {
    next()
  })
  .addHook('preHandler', (request, reply, next) => {
    setImmediate(next)
  })
  .addHook('preHandler', (request, reply, next) => {
    next()
  })

app
  .addHook('onSend', (request, reply, payload, next) => {
    next()
  })

app.get('/', {
  responseSchema: {
    200: {
      type: 'object',
      properties: {
        hello: {
          type: 'string',
        },
      },
    },
  },
}, (request, reply) => {
  reply.send({hello: 'world'})
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }
  // eslint-disable-next-line no-console
  console.log(`server listening on ${app.server.address().port}`)
})
