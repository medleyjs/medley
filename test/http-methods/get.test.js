'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
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

app.listen(0, (err) => {
  t.error(err)
  app.server.unref()

  test('shorthand - request get', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.strictDeepEqual(JSON.parse(body), {hello: 'world'})
    })
  })

  test('shorthand - request get missing schema', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/missing',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.strictDeepEqual(JSON.parse(body), {hello: 'world'})
    })
  })

  test('shorthand - empty response', (t) => {
    t.plan(4)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/empty',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '0')
      t.strictEqual(body.toString(), '')
    })
  })

  test('shorthand - send a falsy boolean', (t) => {
    t.plan(3)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/boolean',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), 'false')
    })
  })

  test('shorthand - send number value', (t) => {
    t.plan(3)
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/number',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), '1234')
    })
  })
})
