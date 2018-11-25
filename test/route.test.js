'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('.route() should throw on missing method', (t) => {
  t.plan(1)

  const app = medley()

  t.throws(
    () => app.route({}),
    new TypeError('Route `method` is required')
  )
})

test('.route() should throw on unsupported method', (t) => {
  t.plan(1)

  const app = medley()

  t.throws(
    () => app.route({method: 'TROLL'}),
    new RangeError('"TROLL" method is not supported')
  )
})

test('.route() should throw if one method in an array is unsupported', (t) => {
  t.plan(1)

  const app = medley()

  t.throws(
    () => app.route({method: ['GET', 'TROLL']}),
    new RangeError('"TROLL" method is not supported')
  )
})

test('Should throw on missing handler', (t) => {
  t.plan(2)

  const app = medley()

  t.throws(
    () => app.route({method: 'GET', path: ''}),
    new TypeError("Route 'handler' must be a function. Got a value of type 'undefined': undefined")
  )
  t.throws(
    () => app.route({method: 'GET', path: '/', handler: false}),
    new TypeError("Route 'handler' must be a function. Got a value of type 'boolean': false")
  )
})

test('.route() throws if path is not a string', (t) => {
  t.plan(4)

  const app = medley()

  t.throws(
    () => app.route({method: 'GET', handler: () => {}}),
    new TypeError("Route 'path' must be a string. Got a value of type 'undefined': undefined")
  )
  t.throws(
    () => app.route({method: 'GET', handler: () => {}, path: true}),
    new TypeError("Route 'path' must be a string. Got a value of type 'boolean': true")
  )
  t.throws(
    () => app.get(true),
    new TypeError("Route 'path' must be a string. Got a value of type 'boolean': true")
  )
  t.throws(
    () => app.get(null),
    new TypeError("Route 'path' must be a string. Got a value of type 'object': null")
  )
})

test('.route() should throw on multiple assignment to the same route', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', () => {})

  t.throws(
    () => app.get('/', () => {}),
    new Error("Method 'GET' already declared for route '/'")
  )
})

test('route - get', (t) => {
  t.plan(3)

  const app = medley()

  app.route({
    method: 'GET',
    path: '/',
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
    path: '/missing',
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
    path: '/multiple',
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
    path: '/add-multiple',
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
    path: '/1',
    handler(request, response) {
      response.send(1)
    },
  })

  app.listen(0, (err) => {
    t.error(err)

    try {
      app.route({
        method: 'GET',
        path: '/another-route',
        handler() { },
      })
      t.fail()
    } catch (err) {
      t.equal(err.message, 'Cannot add route when app is already loaded')
    }
  })
})

test('the handler can be specified in the options object of a shorthand method', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', {
    handler(request, response) {
      response.send({hello: 'world'})
    },
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'world'})
  })
})

test('handler as the third parameter of a shorthand method takes precedence over handler in the options object', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', {
    handler(request, response) {
      response.send({hello: 'options'})
    },
  }, function(request, response) {
    response.send({hello: 'parameter'})
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(JSON.parse(res.payload), {hello: 'parameter'})
  })
})
