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
