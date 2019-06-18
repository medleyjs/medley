'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')
const jsonParser = require('fast-json-body')

test('addBodyParser should add a custom parser', (t) => {
  t.plan(2)
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

  t.test('in POST', (t) => {
    t.plan(3)

    request(app, '/', {
      method: 'POST',
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.body, '{"hello":"world"}')
    })
  })

  t.test('in OPTIONS', (t) => {
    t.plan(3)

    request(app, '/', {
      method: 'OPTIONS',
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.body, '{"hello":"world"}')
    })
  })
})

test('bodyParser should handle multiple custom parsers', (t) => {
  t.plan(6)

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

  request(app, '/', {
    method: 'POST',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/json',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"hello":"world"}')
  })

  request(app, '/', {
    method: 'POST',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/jsoff',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"hello":"world"}')
  })
})

test('bodyParser should handle errors', (t) => {
  t.plan(6)

  const app = medley()

  app.post('/', (req, res) => {
    res.send({fail: 'Handler was reached (it should not have been)'})
  })

  app.addBodyParser('application/json', function(req, done) {
    done(new Error('kaboom!'))
  })

  app.addBodyParser('application/jsoff', function() {
    return Promise.reject(new Error('kaboom!'))
  })

  request(app, '/', {
    method: 'POST',
    body: {hello: 'world'},
    json: true,
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.strictDeepEqual(res.body, {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'kaboom!',
    })
  })

  request(app, '/', {
    method: 'POST',
    body: {hello: 'world'},
    json: true,
    headers: {
      'Content-Type': 'application/jsoff',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.strictDeepEqual(res.body, {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'kaboom!',
    })
  })
})

test('bodyParser should support encapsulation', (t) => {
  t.plan(12)
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

  request(app, {
    method: 'POST',
    url: '/',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/json',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"hello":"world"}')
  })

  request(app, {
    method: 'POST',
    url: '/',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/jsoff',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 415)
    t.strictDeepEqual(JSON.parse(res.body), {
      statusCode: 415,
      error: 'Unsupported Media Type',
      message: 'Unsupported Media Type: "application/jsoff"',
    })
  })

  request(app, {
    method: 'POST',
    url: '/sub',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/json',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"hello":"world"}')
  })

  request(app, {
    method: 'POST',
    url: '/sub',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/jsoff',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"hello":"world"}')
  })
})

test('bodyParser should not by default support requests with an unknown Content-Type', (t) => {
  t.plan(6)

  const app = medley()

  app.addBodyParser('application/json', (req, done) => {
    jsonParser(req.stream, done)
  })

  app.post('/', (req, res) => {
    t.fail('route should not be called')
    res.send(req.body)
  })

  request(app, '/', {
    method: 'POST',
    body: 'unknown content type',
    headers: {
      'Content-Type': 'unknown',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 415)
    t.strictDeepEqual(JSON.parse(res.body), {
      statusCode: 415,
      error: 'Unsupported Media Type',
      message: 'Unsupported Media Type: "unknown"',
    })
  })

  request(app, '/', {
    method: 'POST',
    body: 'undefined content type',
    headers: {
      // 'Content-Type': undefined
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 415)
    t.strictDeepEqual(JSON.parse(res.body), {
      statusCode: 415,
      error: 'Unsupported Media Type',
      message: 'Unsupported Media Type: ""',
    })
  })
})

test('bodyParser should allow unknown Content-Types when the allowUnsupportedMediaTypes option is `true`', (t) => {
  t.plan(12)

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

  request(app, {
    method: 'POST',
    url: '/',
    headers: {
      'Content-Type': 'unknown',
    },
    body: 'unknown content type',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
  })

  request(app, {
    method: 'POST',
    url: '/',
    headers: {
      // 'Content-Type': undefined
    },
    body: 'undefined content type',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
  })

  request(app, {
    method: 'POST',
    url: '/sub-app',
    headers: {
      'Content-Type': 'unknown',
    },
    body: 'unknown content type',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body.length, 0)
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
  t.plan(6)

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

  request(app, '/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/jsons',
    },
    body: '{"hello":"world"}',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 415)
  })

  request(app, '/', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/json',
    },
    body: '{"hello":"world"}',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.body, '{"hello":"world"}')
  })
})

test('parsers are matched in the order in which they are added', (t) => {
  t.plan(7)

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

  request(app, '/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: 'true',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.match(res.headers['content-type'], 'text/plain')
    t.equal(res.body, 'first')
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
  t.plan(6)

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

  request(app, '/', {
    method: 'POST',
    body: 'hello',
    headers: {
      'Content-Type': 'very-weird-content-type',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'hello')
  })

  request(app, '/', {
    method: 'POST',
    body: 'hello',
    headers: {
      'Content-Type': '', // Empty string
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'hello')
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
  t.plan(4)
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

  request(app, '/', {
    method: 'POST',
    body: '{"hello":"world"}',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"hello":"world"}')
    app.close()
  })
})

test('bodyParser should handle async parsers', (t) => {
  t.plan(2)
  const app = medley()

  app.post('/', (req, response) => {
    response.send(req.body)
  })

  app.options('/', (req, response) => {
    response.send(req.body)
  })

  app.addBodyParser('application/jsoff', async function(req) {
    const ret = await Promise.resolve(req.stream)
    return ret
  })

  t.test('in POST', (t) => {
    t.plan(3)

    request(app, '/', {
      method: 'POST',
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
    })
  })

  t.test('in OPTIONS', (t) => {
    t.plan(3)

    request(app, '/', {
      method: 'OPTIONS',
      body: '{"hello":"world"}',
      headers: {
        'Content-Type': 'application/jsoff',
      },
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
    })
  })
})
