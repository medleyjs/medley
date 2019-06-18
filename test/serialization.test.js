'use strict'

const {test} = require('tap')
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
    201: { // shorthand
      hello: {
        type: 'number',
      },
    },
  },
}

app.get('/string', opts, (req, res) => {
  res.send({hello: 'world'})
})

app.get('/number', opts, (req, res) => {
  res.status(201).send({hello: 55})
})

app.get('/wrong-object-for-schema', opts, (req, res) => {
  res.status(201).send({uno: 1}) // Will send { }
})

// No checks
app.get('/empty', opts, (req, res) => {
  res.status(204).send()
})

app.get('/400', opts, (req, res) => {
  res.status(400).send({hello: 'DOOM'})
})

test('shorthand - string get ok', (t) => {
  t.plan(4)

  request(app, '/string', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.deepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

test('shorthand - number get ok', (t) => {
  t.plan(4)

  request(app, '/number', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 201)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.deepEqual(JSON.parse(res.body), {hello: 55})
  })
})

test('shorthand - wrong-object-for-schema', (t) => {
  t.plan(4)

  request(app, '/wrong-object-for-schema', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 201)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.deepEqual(JSON.parse(res.body), {})
  })
})

test('shorthand - empty', (t) => {
  t.plan(3)

  request(app, '/empty', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 204)
    t.strictEqual(res.body, '')
  })
})

test('shorthand - 400', (t) => {
  t.plan(4)

  request(app, '/400', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 400)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.deepEqual(JSON.parse(res.body), {hello: 'DOOM'})
  })
})
