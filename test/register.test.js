'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const medley = require('..')

test('register', t => {
  t.plan(17)

  const app = medley()

  app.register(function(subApp, opts, done) {
    t.notEqual(subApp, app)
    t.ok(app.isPrototypeOf(subApp))

    t.is(typeof opts, 'object')
    t.is(typeof done, 'function')

    subApp.get('/first', function(req, reply) {
      reply.send({hello: 'world'})
    })
    done()
  })

  app.register(function(subApp, opts, done) {
    t.notEqual(subApp, app)
    t.ok(app.isPrototypeOf(subApp))

    t.is(typeof opts, 'object')
    t.is(typeof done, 'function')

    subApp.get('/second', function(req, reply) {
      reply.send({hello: 'world'})
    })
    done()
  })

  app.listen(0, err => {
    t.error(err)
    app.server.unref()

    makeRequest('first')
    makeRequest('second')
  })

  function makeRequest(path) {
    sget({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port + '/' + path,
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), {hello: 'world'})
    })
  }
})

test('internal route declaration should pass the error generated by the register to the next handler / 1', t => {
  t.plan(1)
  const app = medley()

  app.register((subApp, opts, next) => {
    next(new Error('kaboom'))
  })

  app.get('/', (req, reply) => {
    reply.send({hello: 'world'})
  })

  app.listen(0, err => {
    app.close()
    t.is(err.message, 'kaboom')
  })
})

test('internal route declaration should pass the error generated by the register to the next handler / 2', t => {
  t.plan(2)
  const app = medley()

  app.register((subApp, opts, next) => {
    next(new Error('kaboom'))
  })

  app.get('/', (req, reply) => {
    reply.send({hello: 'world'})
  })

  app.after(err => {
    t.is(err.message, 'kaboom')
  })

  app.listen(0, err => {
    app.close()
    t.error(err)
  })
})
