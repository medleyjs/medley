'use strict'

const {test} = require('tap')
const request = require('../utils/request')
const app = require('../..')()

const stringSchema = {
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

const nullSchema = {
  responseSchema: {
    200: {
      type: 'number',
    },
  },
}

app.get('/', stringSchema, (req, res) => {
  res.send({hello: 'world'})
})

app.get('/number', nullSchema, (req, res) => {
  res.send(1234)
})

app.get('/missing', (req, res) => {
  res.send({hello: 'world'})
})

app.get('/empty', (req, res) => {
  res.send()
})

app.get('/boolean', (req, res) => {
  res.send(false)
})

test('shorthand - request get', (t) => {
  t.plan(4)

  request(app, '/', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

test('shorthand - request get missing schema', (t) => {
  t.plan(4)

  request(app, '/missing', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})

test('shorthand - empty response', (t) => {
  t.plan(4)

  request(app, '/empty', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '0')
    t.strictEqual(res.body, '')
  })
})

test('shorthand - send a falsy boolean', (t) => {
  t.plan(3)

  request(app, '/boolean', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, 'false')
  })
})

test('shorthand - send number value', (t) => {
  t.plan(3)

  request(app, '/number', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.body, '1234')
  })
})
