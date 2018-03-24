'use strict'

if (require('./testUtils.js').supportsAsyncAwait) {
  require('./body-parser.async')
}

const fs = require('fs')
const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')
const jsonParser = require('fast-json-body')

test('addBodyParser method should exist', (t) => {
  t.plan(1)
  const app = medley()
  t.ok(app.addBodyParser)
})

test('addBodyParser should add a custom parser', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.options('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/jsoff', function(req, done) {
    jsonParser(req.stream, function(err, body) {
      done(err, body)
    })
  })

  app.listen(0, (err) => {
    t.error(err)

    t.tearDown(() => app.close())

    t.test('in POST', (t) => {
      t.plan(3)

      sget({
        method: 'POST',
        url: 'http://localhost:' + app.server.address().port,
        body: '{"hello":"world"}',
        headers: {
          'Content-Type': 'application/jsoff',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })

    t.test('in OPTIONS', (t) => {
      t.plan(3)

      sget({
        method: 'OPTIONS',
        url: 'http://localhost:' + app.server.address().port,
        body: '{"hello":"world"}',
        headers: {
          'Content-Type': 'application/jsoff',
        },
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
      })
    })
  })
})

test('bodyParser should handle multiple custom parsers', (t) => {
  t.plan(7)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.post('/hello', (req, response) => {
    response.send(req.body)
  })

  function customParser(req, done) {
    jsonParser(req.stream, function(err, body) {
      done(err, body)
    })
  }

  app.addBodyParser('application/jsoff', customParser)
  app.addBodyParser('application/ffosj', customParser)

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port + '/hello',
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/ffosj',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))
    })
  })
})

test('bodyParser should handle errors', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/jsoff', function(req, done) {
    done(new Error('kaboom!'), {})
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
      app.close()
    })
  })
})

test('bodyParser should support encapsulation', (t) => {
  t.plan(7)
  const app = medley()

  app.addBodyParser('application/json', function(req, done) {
    jsonParser(req.stream, done)
  })

  app.use((subApp) => {
    subApp.post('/', (req, response) => {
      response.send(req.body)
    })

    subApp.addBodyParser('application/jsoff', function(req, done) {
      jsonParser(req.stream, done)
    })
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), '{"hello":"world"}')
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), '{"hello":"world"}')
    })
  })
})

test('bodyParser should not by default support requests without a Content-Type', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/jsoff', function(req, done) {
    jsonParser(req.stream, done)
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'unknown content type!',
      headers: {
        // 'Content-Type': undefined
      },
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 415)
      app.close()
    })
  })
})

test('bodyParser should not by default support requests with an unknown Content-Type', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/jsoff', function(req, done) {
    jsonParser(req.stream, done)
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'unknown content type!',
      headers: {
        'Content-Type': 'unknown',
      },
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 415)
      app.close()
    })
  })
})

test('contentType must be a string', (t) => {
  t.plan(1)
  const app = medley()

  try {
    app.addBodyParser(null, () => {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'The content type must be a string and cannot be empty')
  }
})

test('contentType cannot be an empty string', (t) => {
  t.plan(1)
  const app = medley()

  try {
    app.addBodyParser('', () => {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'The content type must be a string and cannot be empty')
  }
})

test('the parser must be a function', (t) => {
  t.plan(1)
  const app = medley()

  try {
    app.addBodyParser('aaa', null)
    t.fail()
  } catch (err) {
    t.is(err.message, 'The parser argument must be a function. Got: null')
  }
})

test('catch all body parser', (t) => {
  t.plan(10)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('*', function(req, done) {
    var data = ''
    req.stream.on('data', (chunk) => {
      data += chunk
    })
    req.stream.on('end', () => {
      done(null, data)
    })
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'hello',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), 'hello')
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'hello',
      headers: {
        'Content-Type': 'very-weird-content-type',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), 'hello')
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'hello',
      headers: {
        'Content-Type': '', // Empty string
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.toString(), 'hello')
    })
  })
})

test('catch all body parser should not interfere with other content type parsers', (t) => {
  t.plan(7)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('*', function(req, done) {
    var data = ''
    req.stream.on('data', (chunk) => {
      data += chunk
    })
    req.stream.on('end', () => {
      done(null, data)
    })
  })

  app.addBodyParser('application/jsoff', function(req, done) {
    jsonParser(req.stream, function(err, body) {
      done(err, body)
    })
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), JSON.stringify({hello: 'world'}))

      sget({
        method: 'POST',
        url: 'http://localhost:' + app.server.address().port,
        body: 'hello',
        headers: {
          'Content-Type': 'very-weird-content-type',
        },
      }, (err, response2, body2) => {
        t.error(err)
        t.strictEqual(response2.statusCode, 200)
        t.deepEqual(body2.toString(), 'hello')
        app.close()
      })
    })
  })
})

// Issue 492 https://github.com/fastify/fastify/issues/492
test('\'*\' catch undefined Content-Type requests', (t) => {
  t.plan(4)

  const app = medley()

  t.tearDown(app.close.bind(app))

  app.addBodyParser('*', function(req, done) {
    var data = ''
    req.stream.on('data', (chunk) => {
      data += chunk
    })
    req.stream.on('end', () => {
      done(null, data)
    })
  })

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.listen(0, function(err) {
    t.error(err)

    const fileStream = fs.createReadStream(__filename)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port + '/',
      body: fileStream,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body + '', fs.readFileSync(__filename).toString())
    })
  })
})

test('cannot add body parser after binding', (t) => {
  t.plan(2)

  const app = medley()

  t.tearDown(app.close.bind(app))

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.listen(0, function(err) {
    t.error(err)

    try {
      app.addBodyParser('*', () => {})
      t.fail()
    } catch (e) {
      t.pass()
    }
  })
})

test('The charset should not interfere with the content type handling', (t) => {
  t.plan(5)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', function(req, done) {
    t.ok('called')
    jsonParser(req.stream, function(err, body) {
      done(err, body)
    })
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), '{"hello":"world"}')
      app.close()
    })
  })
})

test('body parsers added after a sub-app has been created should be inherited by the sub-app', (t) => {
  t.plan(10)

  const app = medley()

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.use((subApp) => {
    subApp.post('/sub-app', (req, res) => {
      res.send(req.body)
    })
  })

  app.addBodyParser('application/json', (req, done) => {
    t.ok('called')
    jsonParser(req.stream, done)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"hello":"world"}')
  })

  app.inject({
    method: 'POST',
    url: '/sub-app',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"hello":"world"}')
  })
})
