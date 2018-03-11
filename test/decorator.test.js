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

test('.decorateReply() should be chainable', (t) => {
  medley()
    .decorateReply('a', 'aVal')
    .decorateReply('b', 'bVal')
  t.end()
})

test('.decorateRequest() should not allow decorating Medley values', (t) => {
  const app = medley()

  try {
    app.decorateRequest('req', null)
    t.fail('should not allow decorating Request with `req`')
  } catch (err) {
    t.equal(err.message, "The decorator 'req' has been already added to Request!")
  }

  try {
    app.decorateRequest('headers', null)
    t.fail('should not allow decorating Request with `headers`')
  } catch (err) {
    t.equal(err.message, "The decorator 'headers' has been already added to Request!")
  }

  try {
    app.decorateRequest('params', null)
    t.fail('should not allow decorating Request with `params`')
  } catch (err) {
    t.equal(err.message, "The decorator 'params' has been already added to Request!")
  }

  try {
    app.decorateRequest('body', null)
    t.fail('should not allow decorating Request with `body`')
  } catch (err) {
    t.equal(err.message, "The decorator 'body' has been already added to Request!")
  }

  try {
    app.decorateRequest('_query', null)
    t.fail('should not allow decorating Request with `_query`')
  } catch (err) {
    t.equal(err.message, "The decorator '_query' has been already added to Request!")
  }

  try {
    app.decorateRequest('query', null)
    t.fail('should not allow decorating Request with `query`')
  } catch (err) {
    t.equal(err.message, "The decorator 'query' has been already added to Request!")
  }

  t.end()
})

test('.decorateReply() should not allow decorating Medley values', (t) => {
  const app = medley()

  try {
    app.decorateReply('res', null)
    t.fail('should not allow decorating Reply with `res`')
  } catch (err) {
    t.equal(err.message, "The decorator 'res' has been already added to Reply!")
  }

  try {
    app.decorateReply('_request', null)
    t.fail('should not allow decorating Reply with `_request`')
  } catch (err) {
    t.equal(err.message, "The decorator '_request' has been already added to Reply!")
  }

  try {
    app.decorateReply('_context', null)
    t.fail('should not allow decorating Reply with `_context`')
  } catch (err) {
    t.equal(err.message, "The decorator '_context' has been already added to Reply!")
  }

  try {
    app.decorateReply('config', null)
    t.fail('should not allow decorating Reply with `config`')
  } catch (err) {
    t.equal(err.message, "The decorator 'config' has been already added to Reply!")
  }

  try {
    app.decorateReply('sent', null)
    t.fail('should not allow decorating Reply with `sent`')
  } catch (err) {
    t.equal(err.message, "The decorator 'sent' has been already added to Reply!")
  }

  try {
    app.decorateReply('_customError', null)
    t.fail('should not allow decorating Reply with `_customError`')
  } catch (err) {
    t.equal(err.message, "The decorator '_customError' has been already added to Reply!")
  }

  try {
    app.decorateReply('_ranHooks', null)
    t.fail('should not allow decorating Reply with `_ranHooks`')
  } catch (err) {
    t.equal(err.message, "The decorator '_ranHooks' has been already added to Reply!")
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

test('decorateReply inside register', (t) => {
  t.plan(12)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.decorateReply('test', 'test')
    t.ok(subApp._Reply.prototype.test)

    subApp.get('/yes', (req, reply) => {
      t.ok(reply.test, 'test exists')
      reply.send({hello: 'world'})
    })

    next()
  })

  app.get('/no', (req, reply) => {
    t.notOk(reply.test)
    reply.send({hello: 'world'})
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

test('decorateReply as plugin (inside .after)', (t) => {
  t.plan(11)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.register(fp((i, o, n) => {
      subApp.decorateReply('test', 'test')
      n()
    })).after(() => {
      subApp.get('/yes', (req, reply) => {
        t.ok(reply.test)
        reply.send({hello: 'world'})
      })
    })
    next()
  })

  app.get('/no', (req, reply) => {
    t.notOk(reply.test)
    reply.send({hello: 'world'})
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

test('decorateReply as plugin (outside .after)', (t) => {
  t.plan(11)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.register(fp((i, o, n) => {
      subApp.decorateReply('test', 'test')
      n()
    }))

    subApp.get('/yes', (req, reply) => {
      t.ok(reply.test)
      reply.send({hello: 'world'})
    })
    next()
  })

  app.get('/no', (req, reply) => {
    t.notOk(reply.test)
    reply.send({hello: 'world'})
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

    subApp.get('/yes', (req, reply) => {
      t.ok(req.test, 'test exists')
      reply.send({hello: 'world'})
    })

    next()
  })

  app.get('/no', (req, reply) => {
    t.notOk(req.test)
    reply.send({hello: 'world'})
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
      subApp.get('/yes', (req, reply) => {
        t.ok(req.test)
        reply.send({hello: 'world'})
      })
    })
    next()
  })

  app.get('/no', (req, reply) => {
    t.notOk(req.test)
    reply.send({hello: 'world'})
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

    subApp.get('/yes', (req, reply) => {
      t.ok(req.test)
      reply.send({hello: 'world'})
    })
    next()
  })

  app.get('/no', (req, reply) => {
    t.notOk(req.test)
    reply.send({hello: 'world'})
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

  app1.decorateReply('test', 'foo')
  app2.decorateReply('test', 'foo')

  t.pass()
})
