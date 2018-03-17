'use strict'

const app = require('..')()

app
  .addHook('onRequest', (req, res, next) => {
    next()
  })
  .addHook('onRequest', (req, res, next) => {
    next()
  })

app
  .addHook('preHandler', (req, res, next) => {
    next()
  })
  .addHook('preHandler', (req, res, next) => {
    setImmediate(next)
  })
  .addHook('preHandler', (req, res, next) => {
    next()
  })

app
  .addHook('onSend', (req, res, payload, next) => {
    next()
  })

app.get('/', {
  responseSchema: {
    200: {
      hello: {type: 'string'},
    },
  },
}, (req, res) => {
  res.send({hello: 'world'})
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }
  // eslint-disable-next-line no-console
  console.log(`server listening on ${app.server.address().port}`)
})
