'use strict'

const t = require('tap')
const request = require('./utils/request')
const app = require('..')()

const opts = {
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
}

app.get('/return', opts, () => Promise.resolve({hello: 'world'}))

app.get('/return-error', opts, () => Promise.reject(new Error('some error')))

t.test('handler promise resolves', (t) => {
  t.plan(4)

  request(app, '/return', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.deepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

t.test('handle promise rejects', (t) => {
  t.plan(2)

  request(app, '/return-error', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})
