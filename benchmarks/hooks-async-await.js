'use strict'

const fastify = require('../fastify')()

const opts = {
  responseSchema: {
    200: {
      type: 'object',
      properties: {
        hello: {
          type: 'string'
        }
      }
    }
  }
}

function promiseFunction (resolve) {
  setImmediate(resolve)
}

async function asyncHook () {
  await new Promise(promiseFunction)
}

fastify
  .addHook('onRequest', asyncHook)
  .addHook('onRequest', asyncHook)
  .addHook('preHandler', asyncHook)
  .addHook('preHandler', asyncHook)
  .addHook('preHandler', asyncHook)
  .addHook('onSend', asyncHook)

fastify.get('/', opts, function (request, reply) {
  reply.send({hello: 'world'})
})

fastify.listen(3000, (err) => {
  if (err) {
    throw err
  }
  // eslint-disable-next-line no-console
  console.log(`server listening on ${fastify.server.address().port}`)
})
