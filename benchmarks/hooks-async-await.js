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
  .addHook('onRequest', asyncHook)
  .addHook('onSend', asyncHook)

app.get('/', (req, res) => {
  res.send('hello world')
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }

  console.log('Server listening on port 3000') // eslint-disable-line no-console
})
