'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')
const fp = require('fastify-plugin')
const sget = require('simple-get').concat

test('.decorate() should be chainable', (t) => {
  const app = medley()
    .decorate('a', 'aVal')
    .decorate('b', 'bVal')

  t.equal(app.a, 'aVal')
  t.equal(app.b, 'bVal')

  t.end()
})

test('.decorateRequest() should be chainable', (t) => {
  medley()
    .decorateRequest('a', 'aVal')
    .decorateRequest('b', 'bVal')
  t.end()
})

test('.decorateResponse() should be chainable', (t) => {
  medley()
    .decorateResponse('a', 'aVal')
    .decorateResponse('b', 'bVal')
  t.end()
})

test('.decorateRequest() should not allow decorating Medley values', (t) => {
  const app = medley()

  try {
    app.decorateRequest('req', null)
    t.fail('should not allow decorating Request with `req`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'req' has been already added to Request")
  }

  try {
    app.decorateRequest('headers', null)
    t.fail('should not allow decorating Request with `headers`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'headers' has been already added to Request")
  }

  try {
    app.decorateRequest('params', null)
    t.fail('should not allow decorating Request with `params`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'params' has been already added to Request")
  }

  try {
    app.decorateRequest('body', null)
    t.fail('should not allow decorating Request with `body`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'body' has been already added to Request")
  }

  try {
    app.decorateRequest('_query', null)
    t.fail('should not allow decorating Request with `_query`')
  } catch (err) {
    t.equal(err.message, "A decorator called '_query' has been already added to Request")
  }

  try {
    app.decorateRequest('query', null)
    t.fail('should not allow decorating Request with `query`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'query' has been already added to Request")
  }

  t.end()
})

test('.decorateResponse() should not allow decorating Medley values', (t) => {
  const app = medley()

  try {
    app.decorateResponse('res', null)
    t.fail('should not allow decorating Response with `res`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'res' has been already added to Response")
  }

  try {
    app.decorateResponse('request', null)
    t.fail('should not allow decorating Response with `request`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'request' has been already added to Response")
  }

  try {
    app.decorateResponse('route', null)
    t.fail('should not allow decorating Response with `route`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'route' has been already added to Response")
  }

  try {
    app.decorateResponse('sent', null)
    t.fail('should not allow decorating Response with `sent`')
  } catch (err) {
    t.equal(err.message, "A decorator called 'sent' has been already added to Response")
  }

  try {
    app.decorateResponse('_customError', null)
    t.fail('should not allow decorating Response with `_customError`')
  } catch (err) {
    t.equal(err.message, "A decorator called '_customError' has been already added to Response")
  }

  try {
    app.decorateResponse('_ranHooks', null)
    t.fail('should not allow decorating Response with `_ranHooks`')
  } catch (err) {
    t.equal(err.message, "A decorator called '_ranHooks' has been already added to Response")
  }

  t.end()
})

test('server methods should be incapsulated via .register', (t) => {
  t.plan(2)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.decorate('test', () => {})
    t.ok(subApp.test)
    next()
  })

  app.ready(() => {
    t.notOk(app.test)
  })
})

test('decorateResponse inside register', (t) => {
  t.plan(12)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.decorateResponse('test', 'test')
    t.ok(subApp._Response.prototype.test)

    subApp.get('/yes', (req, response) => {
      t.ok(response.test, 'test exists')
      response.send({hello: 'world'})
    })

    next()
  })

  app.get('/no', (req, response) => {
    t.notOk(response.test)
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/yes',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('decorateResponse as plugin (inside .after)', (t) => {
  t.plan(11)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.register(fp((i, o, n) => {
      subApp.decorateResponse('test', 'test')
      n()
    })).after(() => {
      subApp.get('/yes', (req, response) => {
        t.ok(response.test)
        response.send({hello: 'world'})
      })
    })
    next()
  })

  app.get('/no', (req, response) => {
    t.notOk(response.test)
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/yes',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('decorateResponse as plugin (outside .after)', (t) => {
  t.plan(11)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.register(fp((i, o, n) => {
      subApp.decorateResponse('test', 'test')
      n()
    }))

    subApp.get('/yes', (req, response) => {
      t.ok(response.test)
      response.send({hello: 'world'})
    })
    next()
  })

  app.get('/no', (req, response) => {
    t.notOk(response.test)
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/yes',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('decorateRequest inside register', (t) => {
  t.plan(12)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.decorateRequest('test', 'test')
    t.ok(subApp._Request.prototype.test)

    subApp.get('/yes', (req, response) => {
      t.ok(req.test, 'test exists')
      response.send({hello: 'world'})
    })

    next()
  })

  app.get('/no', (req, response) => {
    t.notOk(req.test)
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/yes',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('decorateRequest as plugin (inside .after)', (t) => {
  t.plan(11)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.register(fp((i, o, n) => {
      subApp.decorateRequest('test', 'test')
      n()
    })).after(() => {
      subApp.get('/yes', (req, response) => {
        t.ok(req.test)
        response.send({hello: 'world'})
      })
    })
    next()
  })

  app.get('/no', (req, response) => {
    t.notOk(req.test)
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/yes',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('decorateRequest as plugin (outside .after)', (t) => {
  t.plan(11)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.register(fp((i, o, n) => {
      subApp.decorateRequest('test', 'test')
      n()
    }))

    subApp.get('/yes', (req, response) => {
      t.ok(req.test)
      response.send({hello: 'world'})
    })
    next()
  })

  app.get('/no', (req, response) => {
    t.notOk(req.test)
    response.send({hello: 'world'})
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/yes',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/no',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('decorators should be app-independant', (t) => {
  t.plan(1)

  const app1 = medley()
  const app2 = medley()

  app1.decorate('test', 'foo')
  app2.decorate('test', 'foo')

  app1.decorateRequest('test', 'foo')
  app2.decorateRequest('test', 'foo')

  app1.decorateResponse('test', 'foo')
  app2.decorateResponse('test', 'foo')

  t.pass()
})
