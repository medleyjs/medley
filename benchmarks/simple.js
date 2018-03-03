'use strict'

const fastify = require('../fastify')()

const options = {
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

fastify
  .get('/', options, function (request, reply) {
    reply.send({hello: 'world'})
  })

fastify.listen(3000, (err) => {
  if (err) {
    throw err
  }
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${fastify.server.address().port}`)
})
