'use strict'

const fastify = require('../fastify')()

const schema = {
  schema: {
    response: {
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
}

fastify
  .addHook('onRequest', (req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    next()
  })
  .get('/', schema, function (request, reply) {
    reply.send({ hello: 'world' })
  })

fastify.listen(3000, err => {
  if (err) throw err
  console.log(`server listening on ${fastify.server.address().port}`)
})
