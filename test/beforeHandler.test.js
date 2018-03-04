'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('beforeHandler', (t) => {
  t.plan(2)
  const app = medley()

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      req.body.beforeHandler = true
      done()
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {beforeHandler: true, hello: 'world'})
  })
})

test('beforeHandler should be called after preHandler hook', (t) => {
  t.plan(2)
  const app = medley()

  app.addHook('preHandler', (req, reply, next) => {
    req.body.check = 'a'
    next()
  })

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      req.body.check += 'b'
      done()
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {check: 'ab', hello: 'world'})
  })
})

test('beforeHandler should be unique per route', (t) => {
  t.plan(4)
  const app = medley()

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      req.body.hello = 'earth'
      done()
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.post('/no', (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {hello: 'earth'})
  })

  app.inject({
    method: 'POST',
    url: '/no',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {hello: 'world'})
  })
})

test('beforeHandler should handle errors', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      done(new Error('kaboom'))
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.equal(res.statusCode, 500)
    t.deepEqual(payload, {
      message: 'kaboom',
      error: 'Internal Server Error',
      statusCode: 500,
    })
  })
})

test('beforeHandler should handle errors with custom status code', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      reply.code(401)
      done(new Error('go away'))
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.equal(res.statusCode, 401)
    t.deepEqual(payload, {
      message: 'go away',
      error: 'Unauthorized',
      statusCode: 401,
    })
  })
})

test('beforeHandler should handle errors with custom status code in shorthand form', (t) => {
  t.plan(3)
  const app = medley()

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      reply.code(401)
      done(new Error('go away'))
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.equal(res.statusCode, 401)
    t.deepEqual(payload, {
      message: 'go away',
      error: 'Unauthorized',
      statusCode: 401,
    })
  })
})

test('beforeHandler could accept an array of functions', (t) => {
  t.plan(2)
  const app = medley()

  app.post('/', {
    beforeHandler: [
      (req, reply, done) => {
        req.body.beforeHandler = 'a'
        done()
      },
      (req, reply, done) => {
        req.body.beforeHandler += 'b'
        done()
      },
    ],
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {beforeHandler: 'ab', hello: 'world'})
  })
})

test('beforeHandler does not interfere with preHandler', (t) => {
  t.plan(4)
  const app = medley()

  app.addHook('preHandler', (req, reply, next) => {
    req.body.check = 'a'
    next()
  })

  app.post('/', {
    beforeHandler: (req, reply, done) => {
      req.body.check += 'b'
      done()
    },
  }, (req, reply) => {
    reply.send(req.body)
  })

  app.post('/no', (req, reply) => {
    reply.send(req.body)
  })

  app.inject({
    method: 'post',
    url: '/',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {check: 'ab', hello: 'world'})
  })

  app.inject({
    method: 'post',
    url: '/no',
    payload: {hello: 'world'},
  }, (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.deepEqual(payload, {check: 'a', hello: 'world'})
  })
})
