'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
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

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('shorthand - sget return promise es6 get', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/return',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })

  test('shorthand - sget promise es6 get return error', (t) => {
    t.plan(2)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/return-error',
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})
