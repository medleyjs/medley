'use strict'

const test = require('tap').test
const medley = require('..')

test('medley should throw on wrong options', (t) => {
  t.plan(2)
  try {
    require('..')('lol')
    t.fail()
  } catch (e) {
    t.is(e.message, 'Options must be an object')
    t.pass()
  }
})

test('medley should throw on multiple assignment to the same route', (t) => {
  t.plan(1)

  const app = medley()

  app.get('/', () => {})

  t.throws(
    () => app.get('/', () => {}),
    new Error("Method 'GET' already declared for route '/'")
  )
})

test('Should throw on unsupported method', (t) => {
  t.plan(1)
  const app = medley()
  try {
    app.route({
      method: 'TROLL',
      url: '/',
      handler() { },
    })
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('Should throw on missing handler', (t) => {
  t.plan(1)
  const app = medley()
  try {
    app.route({
      method: 'GET',
      url: '/',
    })
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('Should throw if one method is unsupported', (t) => {
  const app = medley()
  t.plan(1)
  try {
    app.route({
      method: ['GET', 'TROLL'],
      url: '/',
      handler() { },
    })
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('Should throw on duplicate body parser', (t) => {
  t.plan(1)

  const app = medley()

  function customParser(req, done) {
    done(null, '')
  }

  app.addBodyParser('application/qq', customParser)
  try {
    app.addBodyParser('application/qq', customParser)
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('Should throw on duplicate decorator', (t) => {
  t.plan(1)

  const app = medley()
  const fooObj = {}

  app.decorate('foo', fooObj)
  try {
    app.decorate('foo', fooObj)
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('Should throw on duplicate request decorator', (t) => {
  t.plan(1)

  const fooObj = {}
  const app = medley()

  app.decorateRequest('foo', fooObj)
  try {
    app.decorateRequest('foo', fooObj)
    t.fail()
  } catch (e) {
    t.ok(/has been already added/.test(e.message))
  }
})

test('Should throw on duplicate response decorator', (t) => {
  t.plan(1)

  const app = medley()
  const fooObj = {}

  app.decorateResponse('foo', fooObj)
  try {
    app.decorateResponse('foo', fooObj)
    t.fail()
  } catch (e) {
    t.ok(/has been already added/.test(e.message))
  }
})

test('should throw on unsupported method in extraBodyParsingMethods option', (t) => {
  t.plan(1)
  t.throws(
    () => medley({extraBodyParsingMethods: ['TROLL']}),
    /is not a supported method/
  )
})
