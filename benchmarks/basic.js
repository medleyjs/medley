'use strict'

const medley = require('..')
const app = medley()

const responseSchema = {
  200: {
    hello: {type: 'string'},
  },
}

app.get('/', {responseSchema}, (req, res) => {
  res.send({hello: 'world'})
})

app.listen(3000, (err) => {
  if (err) {
    throw err
  }

  console.log('Server listening on port 3000') // eslint-disable-line no-console
})
