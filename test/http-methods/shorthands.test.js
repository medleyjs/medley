'use strict'

const t = require('tap')
const medley = require('../..')

const shortHandMethods = [
  'GET',
  'HEAD',
  'DELETE',
  'POST',
  'PUT',
  'PATCH',
  'OPTIONS',
]

t.test('app should register a route when a shorthand method is used', (t) => {
  t.plan(shortHandMethods.length * 3)

  const app = medley()

  function preHandler(req, res, next) {
    next()
  }

  function handler(req, res) {
    res.send(req.method)
  }

  let routeArgs = null

  app.route = (...args) => { // Mock the route method
    routeArgs = args
  }

  shortHandMethods.forEach((method) => {
    app[method.toLowerCase()]('/', handler)
    t.strictDeepEqual(routeArgs, [{
      method,
      path: '/',
      handler,
    }])

    app[method.toLowerCase()]('/with-preHandler', [preHandler], handler)
    t.strictDeepEqual(routeArgs, [{
      method,
      path: '/with-preHandler',
      preHandler: [preHandler],
      handler,
    }])

    app[method.toLowerCase()]('/with-options', {
      config: {a: 'value'},
      preHandler,
      handler,
    })
    t.strictDeepEqual(routeArgs, [{
      method,
      path: '/with-options',
      config: {a: 'value'},
      preHandler,
      handler,
    }])
  })
})
