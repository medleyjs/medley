'use strict'

const {test} = require('tap')
const medley = require('..')

test('app[@@iterator] iterates over registered routes', (t) => {
  t.plan(19)

  const app = medley()

  app.get('/test', () => {})
  app.get('/test/hello', () => {})
  app.get('/hello/world', () => {})
  app.post('/hello/world', () => {})

  function handlePostPut() {}

  function handleDelete() {}

  app.createSubApp('/v1')
    .route({
      method: ['POST', 'PUT'],
      path: '/user',
      handler: handlePostPut,
    })
    .delete('/user', handleDelete)

  const routes = []
  for (const route of app) {
    routes.push(route)
  }

  t.equal(routes.length, 4)

  t.equal(routes[0][0], '/test')
  t.strictDeepEqual(Object.keys(routes[0][1]), ['GET'])
  t.type(routes[0][1].GET, 'object')

  t.equal(routes[1][0], '/test/hello')
  t.strictDeepEqual(Object.keys(routes[1][1]), ['GET'])
  t.type(routes[1][1].GET, 'object')

  t.equal(routes[2][0], '/hello/world')
  t.strictDeepEqual(Object.keys(routes[2][1]), ['GET', 'POST'])
  t.type(routes[2][1].GET, 'object')
  t.type(routes[2][1].POST, 'object')

  t.equal(routes[3][0], '/v1/user')
  t.strictDeepEqual(Object.keys(routes[3][1]), ['POST', 'PUT', 'DELETE'])
  t.type(routes[3][1].POST, 'object')
  t.type(routes[3][1].POST.handler, handlePostPut)
  t.type(routes[3][1].PUT, 'object')
  t.type(routes[3][1].PUT.handler, handlePostPut)
  t.type(routes[3][1].DELETE, 'object')
  t.type(routes[3][1].DELETE.handler, handleDelete)
})

test('app[@@iterator] does not include automatically added route methods', (t) => {
  t.plan(5)

  const app = medley()

  app.get('/test', () => {})

  app.load((err) => {
    t.error(err)

    const routes = Array.from(app)

    t.equal(routes.length, 1)
    t.equal(routes[0][0], '/test')
    t.strictDeepEqual(Object.keys(routes[0][1]), ['GET'])
    t.type(routes[0][1].GET, 'object')
  })
})
