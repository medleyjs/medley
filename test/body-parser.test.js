'use strict'

if (require('./testUtils.js').supportsAsyncAwait) {
  require('./body-parser.async')
}

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')
const jsonParser = require('fast-json-body')

test('addBodyParser should add a custom parser', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.options('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
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
          'Content-Type': 'application/json',
        },
      }, (err, response, body) => {
        t.error(err)
        t.equal(response.statusCode, 200)
        t.equal(body.toString(), '{"hello":"world"}')
      })
    })

    t.test('in OPTIONS', (t) => {
      t.plan(3)

      sget({
        method: 'OPTIONS',
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
    })
  })
})

test('bodyParser should handle multiple custom parsers', (t) => {
  t.plan(7)

  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.addBodyParser('application/jsoff', (req) => {
    return new Promise((resolve, reject) => {
      jsonParser(req.stream, (err, body) => {
        if (err) {
          reject(err)
        } else {
          resolve(body)
        }
      })
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

test('bodyParser should handle errors', (t) => {
  t.plan(7)

  const app = medley()

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.addBodyParser('application/json', function(req, done) {
    done(new Error('kaboom!'))
  })

  app.addBodyParser('application/jsoff', function() {
    return Promise.reject(new Error('kaboom!'))
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
      t.equal(response.statusCode, 500)
      t.equal(JSON.parse(body.toString()).message, 'kaboom!')
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
      t.equal(response.statusCode, 500)
      t.equal(JSON.parse(body.toString()).message, 'kaboom!')
    })
  })
})

test('bodyParser should support encapsulation', (t) => {
  t.plan(13)
  const app = medley()

  app.addBodyParser('application/json', function(req, done) {
    jsonParser(req.stream, done)
  })

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.createSubApp()
    .post('/sub', (req, res) => {
      res.send(req.body)
    })
    .addBodyParser('application/jsoff', function(req, done) {
      jsonParser(req.stream, done)
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
      t.equal(response.statusCode, 415)
      t.strictDeepEqual(JSON.parse(body.toString()), {
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: 'Unsupported Media Type: "application/jsoff"',
      })
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port + '/sub',
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
      url: 'http://localhost:' + app.server.address().port + '/sub',
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

test('bodyParser should not by default support requests with an unknown Content-Type', (t) => {
  t.plan(7)

  const app = medley()

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.post('/', (req, res) => {
    t.fail('route should not be called')
    res.send(req.body)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'unknown content type',
      headers: {
        'Content-Type': 'unknown',
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 415)
      t.strictDeepEqual(JSON.parse(body.toString()), {
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: 'Unsupported Media Type: "unknown"',
      })
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      body: 'undefined content type',
      headers: {
        // 'Content-Type': undefined
      },
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 415)
      t.strictDeepEqual(JSON.parse(body.toString()), {
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: 'Unsupported Media Type: ""',
      })
    })
  })
})

test('bodyParser should allow unknown Content-Types when the allowUnsupportedMediaTypes option is `true`', (t) => {
  t.plan(13)

  const app = medley({allowUnsupportedMediaTypes: true})

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.post('/', (req, res) => {
    t.equal(req.body, undefined)
    res.send()
  })

  app.createSubApp()
    .post('/sub-app', (req, res) => {
      t.equal(req.body, undefined)
      res.send()
    })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'POST',
      url: `http://localhost:${app.server.address().port}/`,
      headers: {
        'Content-Type': 'unknown',
      },
      body: 'unknown content type',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })

    sget({
      method: 'POST',
      url: `http://localhost:${app.server.address().port}/`,
      headers: {
        // 'Content-Type': undefined
      },
      body: 'undefined content type',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })

    sget({
      method: 'POST',
      url: `http://localhost:${app.server.address().port}/sub-app`,
      headers: {
        'Content-Type': 'unknown',
      },
      body: 'unknown content type',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(body.length, 0)
    })
  })
})

test('contentType must be MIME pattern string, an array of such strings, or a function', (t) => {
  t.plan(5)

  const app = medley()
  const func = () => {}

  t.throws(() => app.addBodyParser(null, func), TypeError)
  t.throws(() => app.addBodyParser('', func), Error)
  t.throws(() => app.addBodyParser(['text/plain', 'bogus'], func), Error)

  t.doesNotThrow(() => app.addBodyParser(func, func))
  t.doesNotThrow(() => app.addBodyParser(['text/plain', 'image/*'], func))
})

test('bodyParser should run only if it exactly matches the given content-type', (t) => {
  t.plan(7)

  const app = medley()

  t.tearDown(() => app.close())

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.addBodyParser('application/json', (req, done) => {
    t.fail('application/json should never be matched')
    jsonParser(req.stream, done)
  })

  app.addBodyParser('*/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'Content-Type': 'application/jsons',
      },
      body: '{"hello":"world"}',
    }, (err, response) => {
      t.error(err)
      t.equal(response.statusCode, 415)
    })

    sget({
      method: 'POST',
      url: 'http://localhost:' + app.server.address().port,
      headers: {
        'Content-Type': 'text/json',
      },
      body: '{"hello":"world"}',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(response.headers['content-type'], 'application/json')
      t.equal(body.toString(), '{"hello":"world"}')
    })
  })
})

test('parsers are matched in the order in which they are added', (t) => {
  t.plan(8)

  const app = medley()

  t.tearDown(() => app.close())

  var order = 0

  app.addBodyParser(() => {
    t.equal(order++, 0)
    return false
  }, () => t.fail('unmatched body parser should not be called'))

  app.addBodyParser(() => {
    t.equal(order++, 1)
    return false
  }, () => t.fail('unmatched body parser should not be called'))

  app.addBodyParser('application/*', function(req, done) {
    t.equal(order++, 2)
    done(null, 'first')
  })

  app.addBodyParser('application/json', function() {
    t.fail('the second body parser should never be called')
  })

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.listen(0, (err) => {
    t.error(err)

    sget({
      method: 'POST',
      url: `http://localhost:${app.server.address().port}`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'true',
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.match(response.headers['content-type'], 'text/plain')
      t.equal(body.toString(), 'first')
    })
  })
})

test('the parser must be a function', (t) => {
  t.plan(1)

  const app = medley()

  t.throws(
    () => app.addBodyParser('aaa', null),
    new TypeError('The parser argument must be a function. Got: null')
  )
})

test('"catch all" body parser', (t) => {
  t.plan(7)

  const app = medley()

  app.post('/', (req, res) => {
    res.send(req.body)
  })

  app.addBodyParser(() => true, function(req, done) {
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
