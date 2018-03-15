'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('route - get', (t) => {
  t.plan(3)

  const app = medley()

  app.route({
    method: 'GET',
    url: '/',
    responseSchema: {
      200: {
        type: 'object',
        properties: {
          hello: {
            type: 'string',
          },
        },
      },
    },
    handler(request, response) {
      response.send({hello: 'world'})
    },
  })

  app.inject('/', (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'world'})
  })
})

test('missing schema - route', (t) => {
  t.plan(3)

  const app = medley()

  app.route({
    method: 'GET',
    url: '/missing',
    handler(request, response) {
      response.send({hello: 'world'})
    },
  })

  app.inject('/missing', (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'world'})
  })
})

test('Multiple methods', (t) => {
  t.plan(6)

  const app = medley()

  app.route({
    method: ['GET', 'DELETE'],
    url: '/multiple',
    handler(request, response) {
      response.send({hello: 'world'})
    },
  })

  app.inject('/multiple', (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'world'})
  })

  app.inject({
    method: 'DELETE',
    url: '/multiple',
  }, (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'world'})
  })
})

test('Add multiple methods', (t) => {
  t.plan(9)

  const app = medley()

  app.get('/add-multiple', (request, response) => {
    response.send({hello: 'Bob!'})
  })

  app.route({
    method: ['PUT', 'DELETE'],
    url: '/add-multiple',
    handler(request, response) {
      response.send({hello: 'world'})
    },
  })

  app.inject('/add-multiple', (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'Bob!'})
  })

  app.inject({
    method: 'PUT',
    url: '/add-multiple',
  }, (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'world'})
  })

  app.inject({
    method: 'DELETE',
    url: '/add-multiple',
  }, (err, response) => {
    t.error(err)
    t.equal(response.statusCode, 200)
    t.deepEqual(JSON.parse(response.payload), {hello: 'world'})
  })
})

test('cannot add another route after server is listening', (t) => {
  t.plan(2)

  const app = medley()

  t.tearDown(() => app.close())

  app.route({
    method: 'GET',
    url: '/1',
    handler(request, response) {
      response.send(1)
    },
  })

  app.listen(0, (err) => {
    t.error(err)

    try {
      app.route({
        method: 'GET',
        url: '/another-route',
        handler() { },
      })
      t.fail()
    } catch (err) {
      t.equal(err.message, 'Cannot add route when app is already loaded')
    }
  })
})

test('path can be specified in place of uri', (t) => {
  t.plan(3)

  const app = medley()

  app.route({
    method: 'GET',
    path: '/path',
    handler(request, response) {
      response.send({hello: 'world'})
    },
  })

  app.inject('/path', (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('invalid bodyLimit option - route', (t) => {
  t.plan(2)

  const app = medley()

  try {
    app.route({
      bodyLimit: false,
      method: 'PUT',
      handler() { },
    })
    t.fail('bodyLimit must be an integer')
  } catch (err) {
    t.equal(err.message, "'bodyLimit' option must be an integer > 0. Got 'false'")
  }

  try {
    app.post('/url', {bodyLimit: 10000.1}, () => null)
    t.fail('bodyLimit must be an integer')
  } catch (err) {
    t.equal(err.message, "'bodyLimit' option must be an integer > 0. Got '10000.1'")
  }
})

test('.route() should forward the error if creating a serializer fails', (t) => {
  t.plan(1)

  const app = medley()

  app.route({
    method: 'GET',
    path: '/',
    responseSchema: {
      200: {
        type: 'invalid-type',
      },
    },
    handler() {},
  })

  app.ready((err) => {
    t.equal(err.message, 'Invalid type: invalid-type')
  })
})
