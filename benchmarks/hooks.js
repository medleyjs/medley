'use strict'

const app = require('..')()

app
  .addHook('onRequest', (request, response, next) => {
    next()
  })
  .addHook('onRequest', (request, response, next) => {
    next()
  })

app
  .addHook('preHandler', (request, response, next) => {
    next()
  })
  .addHook('preHandler', (request, response, next) => {
    setImmediate(next)
  })
  .addHook('preHandler', (request, response, next) => {
    next()
  })

app
  .addHook('onSend', (request, response, payload, next) => {
    next()
  })

app.get('/', {
  responseSchema: {
    200: {
      hello: {type: 'string'},
    },
  },
}, (request, response) => {
  response.send({hello: 'world'})
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }
  // eslint-disable-next-line no-console
  console.log(`server listening on ${app.server.address().port}`)
})
