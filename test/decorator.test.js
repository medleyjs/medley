'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')
const fp = require('fastify-plugin')
const sget = require('simple-get').concat

test('server methods should exist', t => {
  t.plan(2)
  const app = medley()
  t.ok(app.decorate)
  t.ok(app.hasDecorator)
})

test('server methods should be incapsulated via .register', t => {
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

test('hasServerMethod should check if the given method already exist', t => {
  t.plan(2)
  const app = medley()

  app.register((subApp, opts, next) => {
    subApp.decorate('test', () => {})
    t.ok(subApp.hasDecorator('test'))
    next()
  })

  app.ready(() => {
    t.notOk(app.hasDecorator('test'))
  })
})

test('decorate should throw if a declared dependency is not present', t => {
  t.plan(2)
  const app = medley()

  app.register((subApp, opts, next) => {
    try {
      subApp.decorate('test', () => {}, ['dependency'])
      t.fail()
    } catch (e) {
      t.is(e.message, 'medley decorator: missing dependency: \'dependency\'.')
    }
    next()
  })

  app.ready(() => t.pass())
})

// issue #777
test('should pass error for missing request decorator', t => {
  t.plan(2)
  const app = medley()

  const plugin = fp(function(subApp, opts, next) {
    next()
  }, {
    decorators: {
      request: ['foo'],
    },
  })
  app
    .register(plugin)
    .ready((err) => {
      t.type(err, Error)
      t.match(err, /The decorator 'foo'/)
    })
})

test('decorateReply inside register', t => {
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

  app.listen(0, err => {
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

test('decorateReply as plugin (inside .after)', t => {
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

  app.listen(0, err => {
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

test('decorateReply as plugin (outside .after)', t => {
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

  app.listen(0, err => {
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

test('decorateRequest inside register', t => {
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

  app.listen(0, err => {
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

test('decorateRequest as plugin (inside .after)', t => {
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

  app.listen(0, err => {
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

test('decorateRequest as plugin (outside .after)', t => {
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

  app.listen(0, err => {
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

test('decorators should be subApp separated', t => {
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
