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
  app.get('/', () => {})

  app.ready((err) => {
    t.is(err.message, "Method 'GET' already declared for route '/'")
  })
})

test('Should throw on unsupported method', (t) => {
  t.plan(1)
  const app = medley()
  try {
    app.route({
      method: 'TROLL',
      url: '/',
      handler(req, reply) {},
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
      handler(req, reply) {},
    })
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('Should throw on duplicate content type parser', (t) => {
  t.plan(1)

  const app = medley()

  function customParser(req, done) {
    done(null, '')
  }

  app.addContentTypeParser('application/qq', customParser)
  try {
    app.addContentTypeParser('application/qq', customParser)
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

test('Should throw on duplicate decorator encapsulation', (t) => {
  t.plan(1)

  const app = medley()
  const foo2Obj = {}

  app.decorate('foo2', foo2Obj)

  app.register(function(app, opts, next) {
    try {
      app.decorate('foo2', foo2Obj)
      t.fail()
    } catch (e) {
      t.pass()
    }
    next()
  })

  app.ready()
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

test('Should throw if request decorator dependencies are not met', (t) => {
  t.plan(1)

  const app = medley()
  const fooObj = {}

  try {
    app.decorateRequest('bar', fooObj, ['world'])
    t.fail()
  } catch (e) {
    t.ok(/missing dependency/.test(e.message))
  }
})

test('Should throw on duplicate reply decorator', (t) => {
  t.plan(1)

  const app = medley()
  const fooObj = {}

  app.decorateReply('foo', fooObj)
  try {
    app.decorateReply('foo', fooObj)
    t.fail()
  } catch (e) {
    t.ok(/has been already added/.test(e.message))
  }
})

test('Should throw if reply decorator dependencies are not met', (t) => {
  t.plan(1)

  const app = medley()
  const fooObj = {}

  try {
    app.decorateReply('bar', fooObj, ['world'])
    t.fail()
  } catch (e) {
    t.ok(/missing dependency/.test(e.message))
  }
})
