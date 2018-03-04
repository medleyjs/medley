'use strict'

const medley = require('..')
const app = medley()

const responseSchema = {
  200: {
    type: 'object',
    properties: {
      hello: {
        type: 'string',
      },
    },
  },
}

app.get('/', {responseSchema}, (request, reply) => {
  reply.send({hello: 'world'})
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${app.server.address().port}`)
})
