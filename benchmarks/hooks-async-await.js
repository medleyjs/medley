'use strict'

const app = require('..')()

function promiseFunction(resolve) {
  setImmediate(resolve)
}

async function asyncHook() {
  await new Promise(promiseFunction)
}

app
  .addHook('onRequest', asyncHook)
  .addHook('onRequest', asyncHook)
  .addHook('preHandler', asyncHook)
  .addHook('preHandler', asyncHook)
  .addHook('preHandler', asyncHook)
  .addHook('onSend', asyncHook)

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
