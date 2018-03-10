'use strict'

const app = require('..')()

app
  .addHook('onRequest', (request, reply, next) => {
    next()
  })
  .addHook('onRequest', (request, reply, next) => {
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
      hello: {type: 'string'},
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
