'use strict'

const app = require('..')()

app
  .addHook('onRequest', (req, res, next) => {
    next()
  })
  .addHook('onRequest', (req, res, next) => {
    setImmediate(next)
  })
  .addHook('onRequest', (req, res, next) => {
    next()
  })

app
  .addHook('onSend', (req, res, payload, next) => {
    next()
  })

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }
  console.log('Server listening on port 3000') // eslint-disable-line no-console
})
