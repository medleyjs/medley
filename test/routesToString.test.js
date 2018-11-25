'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('app.routesToString()', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/test', () => {})
  app.get('/test/hello', () => {})
  app.get('/hello/world', () => {})
  app.post('/hello/world', () => {})

  app.encapsulate('/v1', (subApp) => {
    subApp.route({
      method: ['POST', 'PUT'],
      path: '/user',
      handler() {},
    })
    subApp.delete('/user', () => {})
  })

  const expected =
`/test (GET)
/test/hello (GET)
/hello/world (GET,POST)
/v1/user (POST,PUT,DELETE)`

  t.equal(app.routesToString(), expected)
})

test('app.routesToString() does not print automatically added route methods', (t) => {
  t.plan(2)

  const app = medley()

  app.get('/test', () => {})

  app.load((err) => {
    t.error(err)
    t.equal(app.routesToString(), '/test (GET)')
  })
})
