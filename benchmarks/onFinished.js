'use strict'

const medley = require('..')
const app = medley()

app.addHook('onFinished', res => res)

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }
  console.log('Server listening on port 3000') // eslint-disable-line no-console
})
