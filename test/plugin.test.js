'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')
const sget = require('simple-get').concat
const fp = require('fastify-plugin')

test('require a plugin', t => {
  t.plan(1)
  const app = medley()
  app.register(require('./plugin.helper'))
  app.ready(() => {
    t.ok(app.test)
  })
})

test('app.register with fastify-plugin should not incapsulate his code', t => {
  t.plan(10)
  const app = medley()

  app.register((instance, opts, next) => {
    instance.register(fp((i, o, n) => {
      i.decorate('test', () => {})
      t.ok(i.test)
      n()
    }))

    t.notOk(instance.test)

    // the decoration is added at the end
    instance.after(() => {
      t.ok(instance.test)
    })

    instance.get('/', (req, reply) => {
      t.ok(instance.test)
      reply.send({hello: 'world'})
    })

    next()
  })

  app.ready(() => {
    t.notOk(app.test)
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('app.register with fastify-plugin registers root level plugins', t => {
  t.plan(15)
  const app = medley()

  function rootPlugin(instance, opts, next) {
    instance.decorate('test', 'first')
    t.ok(instance.test)
    next()
  }

  function innerPlugin(instance, opts, next) {
    instance.decorate('test2', 'second')
    next()
  }

  app.register(fp(rootPlugin))

  app.register((instance, opts, next) => {
    t.ok(instance.test)
    instance.register(fp(innerPlugin))

    instance.get('/test2', (req, reply) => {
      t.ok(instance.test2)
      reply.send({test2: instance.test2})
    })

    next()
  })

  app.ready(() => {
    t.ok(app.test)
    t.notOk(app.test2)
  })

  app.get('/', (req, reply) => {
    t.ok(app.test)
    reply.send({test: app.test})
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {test: 'first'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/test2',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {test2: 'second'})
    })
  })
})

test('check dependencies - should not throw', t => {
  t.plan(12)
  const app = medley()

  app.register((instance, opts, next) => {
    instance.register(fp((i, o, n) => {
      i.decorate('test', () => {})
      t.ok(i.test)
      n()
    }))

    instance.register(fp((i, o, n) => {
      try {
        i.decorate('otherTest', () => {}, ['test'])
        t.ok(i.test)
        t.ok(i.otherTest)
        n()
      } catch (e) {
        t.fail()
      }
    }))

    instance.get('/', (req, reply) => {
      t.ok(instance.test)
      t.ok(instance.otherTest)
      reply.send({hello: 'world'})
    })

    next()
  })

  app.ready(() => {
    t.notOk(app.test)
    t.notOk(app.otherTest)
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('check dependencies - should throw', t => {
  t.plan(11)
  const app = medley()

  app.register((instance, opts, next) => {
    instance.register(fp((i, o, n) => {
      try {
        i.decorate('otherTest', () => {}, ['test'])
        t.fail()
      } catch (e) {
        t.is(e.message, 'medley decorator: missing dependency: \'test\'.')
      }
      n()
    }))

    instance.register(fp((i, o, n) => {
      i.decorate('test', () => {})
      t.ok(i.test)
      t.notOk(i.otherTest)
      n()
    }))

    instance.get('/', (req, reply) => {
      t.ok(instance.test)
      t.notOk(instance.otherTest)
      reply.send({hello: 'world'})
    })

    next()
  })

  app.ready(() => {
    t.notOk(app.test)
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  })
})

test('plugin incapsulation', t => {
  t.plan(10)
  const app = medley()

  app.register((instance, opts, next) => {
    instance.register(fp((i, o, n) => {
      i.decorate('test', 'first')
      n()
    }))

    instance.get('/first', (req, reply) => {
      reply.send({plugin: instance.test})
    })

    next()
  })

  app.register((instance, opts, next) => {
    instance.register(fp((i, o, n) => {
      i.decorate('test', 'second')
      n()
    }))

    instance.get('/second', (req, reply) => {
      reply.send({plugin: instance.test})
    })

    next()
  })

  app.ready(() => {
    t.notOk(app.test)
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/first',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {plugin: 'first'})
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/second',
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {plugin: 'second'})
    })
  })
})

test('if a plugin raises an error and there is not a callback to handle it, the server must not start', t => {
  t.plan(2)
  const app = medley()

  app.register((instance, opts, next) => {
    next(new Error('err'))
  })

  app.listen(0, err => {
    t.ok(err instanceof Error)
    t.is(err.message, 'err')
  })
})

test('add hooks after route declaration', t => {
  t.plan(3)
  const app = medley()

  function plugin(instance, opts, next) {
    instance.decorateRequest('check', {})
    setImmediate(next)
  }

  app.register(fp(plugin))

  app.register((instance, options, next) => {
    instance.addHook('preHandler', function b(req, res, next) {
      req.check.hook2 = true
      next()
    })

    instance.get('/', (req, reply) => {
      reply.send(req.check)
    })

    instance.addHook('preHandler', function c(req, res, next) {
      req.check.hook3 = true
      next()
    })

    next()
  })

  app.addHook('preHandler', function a(req, res, next) {
    req.check.hook1 = true
    next()
  })

  app.listen(0, err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port,
    }, (err, response, body) => {
      t.error(err)
      t.deepEqual(JSON.parse(body), {hook1: true, hook2: true, hook3: true})
      app.close()
    })
  })
})

test('nested plugins', t => {
  t.plan(5)

  const app = medley()

  t.tearDown(app.close.bind(app))

  app.register(function(app, opts, next) {
    app.register((app, opts, next) => {
      app.get('/', function(req, reply) {
        reply.send('I am child 1')
      })
      next()
    }, {prefix: '/child1'})

    app.register((app, opts, next) => {
      app.get('/', function(req, reply) {
        reply.send('I am child 2')
      })
      next()
    }, {prefix: '/child2'})

    next()
  }, {prefix: '/parent'})

  app.listen(0, err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/parent/child1',
    }, (err, response, body) => {
      t.error(err)
      t.deepEqual(body.toString(), 'I am child 1')
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/parent/child2',
    }, (err, response, body) => {
      t.error(err)
      t.deepEqual(body.toString(), 'I am child 2')
    })
  })
})

test('plugin metadata - decorators', t => {
  t.plan(1)
  const app = medley()

  app.decorate('plugin1', true)
  app.decorateReply('plugin1', true)
  app.decorateRequest('plugin1', true)

  plugin[Symbol.for('skip-override')] = true
  plugin[Symbol.for('plugin-meta')] = {
    decorators: {
      app: ['plugin1'],
      reply: ['plugin1'],
      request: ['plugin1'],
    },
  }

  app.register(plugin)

  app.ready(() => {
    t.ok(app.plugin)
  })

  function plugin(instance, opts, next) {
    instance.decorate('plugin', true)
    next()
  }
})

test('plugin metadata - dependencies', t => {
  t.plan(1)
  const app = medley()

  dependency[Symbol.for('skip-override')] = true
  dependency[Symbol.for('plugin-meta')] = {
    name: 'plugin',
  }

  plugin[Symbol.for('skip-override')] = true
  plugin[Symbol.for('plugin-meta')] = {
    dependencies: ['plugin'],
  }

  app.register(dependency)
  app.register(plugin)

  app.ready(() => {
    t.pass('everything right')
  })

  function dependency(instance, opts, next) {
    next()
  }

  function plugin(instance, opts, next) {
    next()
  }
})

test('plugin metadata - dependencies (nested)', t => {
  t.plan(1)
  const app = medley()

  dependency[Symbol.for('skip-override')] = true
  dependency[Symbol.for('plugin-meta')] = {
    name: 'plugin',
  }

  nested[Symbol.for('skip-override')] = true
  nested[Symbol.for('plugin-meta')] = {
    dependencies: ['plugin'],
  }

  app.register(dependency)
  app.register(plugin)

  app.ready(() => {
    t.pass('everything right')
  })

  function dependency(instance, opts, next) {
    next()
  }

  function plugin(instance, opts, next) {
    instance.register(nested)
    next()
  }

  function nested(instance, opts, next) {
    next()
  }
})
