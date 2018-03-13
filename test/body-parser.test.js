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
    jsonParser(req, function(err, body) {
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
    jsonParser(req, function(err, body) {
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
  t.plan(6)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.addBodyParser('application/jsoff', () => {})
    t.ok(subApp.hasBodyParser('application/jsoff'))

    subApp.register((subApp2, opts, next) => {
      subApp2.addBodyParser('application/ffosj', () => {})
      t.ok(subApp2.hasBodyParser('application/jsoff'))
      t.ok(subApp2.hasBodyParser('application/ffosj'))
      next()
    })

    next()
  })

  app.ready((err) => {
    t.error(err)
    t.notOk(app.hasBodyParser('application/jsoff'))
    t.notOk(app.hasBodyParser('application/ffosj'))
  })
})

test('bodyParser should support encapsulation, second try', (t) => {
  t.plan(4)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.post('/', (req, response) => {
      response.send(req.body)
    })

    subApp.addBodyParser('application/jsoff', function(req, done) {
      jsonParser(req, function(err, body) {
        done(err, body)
      })
    })

    next()
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
      app.close()
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
    jsonParser(req, function(err, body) {
      done(err, body)
    })
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
    jsonParser(req, function(err, body) {
      done(err, body)
    })
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
  t.plan(7)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('*', function(req, done) {
    var data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      done(null, data)
    })
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'hello',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.deepEqual(body.toString(), 'hello')

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

test('catch all body parser should not interfere with other content type parsers', (t) => {
  t.plan(7)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('*', function(req, done) {
    var data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      done(null, data)
    })
  })

  app.addBodyParser('application/jsoff', function(req, done) {
    jsonParser(req, function(err, body) {
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
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      done(null, data)
    })
  })

  app.post('/', (req, res) => {
    // Needed to avoid json stringify
    res.type('text/plain').send(req.body)
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
    res.type('text/plain').send(req.body)
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

test('BodyParser should support parsing JSON by default', (t) => {
  t.plan(3)

  const app = medley()

  app.post('/', (request, response) => {
    response.send(request.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {json: 'body'},
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.strictDeepEqual(JSON.parse(res.payload), {json: 'body'})
  })
})

test('Can override the default JSON parser', (t) => {
  t.plan(5)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', function(req, done) {
    t.ok('called')
    jsonParser(req, function(err, body) {
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
        'Content-Type': 'application/json',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), '{"hello":"world"}')
      app.close()
    })
  })
})

test('Cannot override the JSON parser multiple times', (t) => {
  t.plan(1)
  const app = medley()

  app.addBodyParser('application/json', function(req, done) {
    jsonParser(req, function(err, body) {
      done(err, body)
    })
  })

  try {
    app.addBodyParser('application/json', function(req, done) {
      t.ok('called')
      jsonParser(req, function(err, body) {
        done(err, body)
      })
    })
  } catch (err) {
    t.is(err.message, 'Body parser for content type \'application/json\' already present.')
  }
})

test('Should get the body as string', (t) => {
  t.plan(6)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', {parseAs: 'string'}, function(req, body, done) {
    t.ok('called')
    t.ok(typeof body === 'string')
    try {
      var json = JSON.parse(body)
      done(null, json)
    } catch (err) {
      err.statusCode = 400
      done(err, undefined)
    }
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), '{"hello":"world"}')
      app.close()
    })
  })
})

test('Should get the body as buffer', (t) => {
  t.plan(6)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', {parseAs: 'buffer'}, function(req, body, done) {
    t.ok('called')
    t.ok(body instanceof Buffer)
    try {
      var json = JSON.parse(body)
      done(null, json)
    } catch (err) {
      err.statusCode = 400
      done(err, undefined)
    }
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(body.toString(), '{"hello":"world"}')
      app.close()
    })
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
    jsonParser(req, function(err, body) {
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

test('should validate the parseAs option', (t) => {
  t.plan(1)
  const app = medley()

  try {
    app.addBodyParser('application/json', {parseAs: 'fireworks'}, () => {})
    t.fail('should throw')
  } catch (err) {
    t.is(err.message, "The 'parseAs' option must be either 'string' or 'buffer'. Got 'fireworks'.")
  }
})

test('should validate the bodyLimit option', (t) => {
  t.plan(2)
  const app = medley()

  try {
    app.addBodyParser('application/json', {bodyLimit: null}, () => {})
    t.fail('should throw')
  } catch (err) {
    t.is(err.message, "'bodyLimit' option must be an integer > 0. Got 'null'")
  }

  try {
    app.addBodyParser('application/json', {bodyLimit: 1.5}, () => {})
    t.fail('should throw')
  } catch (err) {
    t.is(err.message, "'bodyLimit' option must be an integer > 0. Got '1.5'")
  }
})

test('the bodyLimit option may only be used with the parseAs option', (t) => {
  t.plan(1)
  const app = medley()

  try {
    app.addBodyParser('application/json', {bodyLimit: 20}, () => {})
    t.fail('should throw')
  } catch (err) {
    t.is(err.message, "Received the 'bodyLimit' option without the 'parseAs' option. " +
      "The 'bodyLimit' option has no effect without the 'parseAs' option.")
  }
})

test('should allow defining the bodyLimit per parser', (t) => {
  t.plan(3)
  const app = medley()
  t.tearDown(() => app.close())

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser(
    'x/foo',
    {parseAs: 'string', bodyLimit: 5},
    function(req, body, done) {
      t.fail('should not be invoked')
      done()
    }
  )

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '1234567890',
      headers: {
        'Content-Type': 'x/foo',
      },
    }, (err, response, body) => {
      t.error(err)
      t.strictDeepEqual(JSON.parse(body.toString()), {
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Request body is too large',
      })
      app.close()
    })
  })
})

test('route bodyLimit should take precedence over a custom parser bodyLimit', (t) => {
  t.plan(3)
  const app = medley()
  t.tearDown(() => app.close())

  app.post('/', {bodyLimit: 5}, (request, response) => {
    response.send(request.body)
  })

  app.addBodyParser(
    'x/foo',
    {parseAs: 'string', bodyLimit: 100},
    function(req, body, done) {
      t.fail('should not be invoked')
      done()
    }
  )

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: '1234567890',
      headers: {'Content-Type': 'x/foo'},
    }, (err, response, body) => {
      t.error(err)
      t.strictDeepEqual(JSON.parse(body.toString()), {
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Request body is too large',
      })
      app.close()
    })
  })
})
