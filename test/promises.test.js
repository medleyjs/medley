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

app.get('/return', opts, function(req, reply) {
  const promise = new Promise((resolve, reject) => {
    resolve({hello: 'world'})
  })
  return promise
})

app.get('/return-error', opts, function(req, reply) {
  const promise = new Promise((resolve, reject) => {
    reject(new Error('some error'))
  })
  return promise
})

app.get('/double', function(req, reply) {
  setTimeout(function() {
    // this should not throw
    reply.send({hello: 'world'})
  }, 20)
  return Promise.resolve({hello: '42'})
})

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
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })

  test('sget promise double send', (t) => {
    t.plan(3)

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/double',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(JSON.parse(body), {hello: '42'})
    })
  })
})
