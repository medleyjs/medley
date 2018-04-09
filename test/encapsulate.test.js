'use strict'

const t = require('tap')
const medley = require('..')

function noop() { }

t.test('.encapsulate() throws if subAppFn is not a function', (t) => {
  const app = medley()

  t.throws(
    () => app.encapsulate(),
    new TypeError("'subAppFn' must be a function. Got a value of type 'undefined': undefined")
  )
  t.throws(
    () => app.encapsulate(null),
    new TypeError("'subAppFn' must be a function. Got a value of type 'object': null")
  )
  t.throws(
    () => app.encapsulate('string'),
    new TypeError("'subAppFn' must be a function. Got a value of type 'string': string")
  )

  t.end()
})

t.test('.encapsulate() throws if prefix is not a string', (t) => {
  const app = medley()

  t.throws(
    () => app.encapsulate(undefined, noop),
    new TypeError("'prefix' must be a string. Got a value of type 'undefined': undefined")
  )
  t.throws(
    () => app.encapsulate(null, noop),
    new TypeError("'prefix' must be a string. Got a value of type 'object': null")
  )
  t.throws(
    () => app.encapsulate(2, noop),
    new TypeError("'prefix' must be a string. Got a value of type 'number': 2")
  )

  t.end()
})

t.test('.encapsulate() throws if prefix does not start with a "/"', (t) => {
  const app = medley()

  t.throws(
    () => app.encapsulate('v1', noop),
    new Error("'prefix' must start with a '/' character. Got: 'v1'")
  )

  t.end()
})

t.test('.encapsulate() creates a new app that inherits from the app that .encapsulate() was called on', (t) => {
  t.plan(2)

  const app = medley()

  app.encapsulate(function(subApp) {
    t.notEqual(subApp, app)
    t.ok(app.isPrototypeOf(subApp))
  })
})

t.test('.encapsulate() executes the subAppFn immediately', (t) => {
  t.plan(2)

  const app = medley()
  var executed = false

  app.encapsulate(function() {
    t.equal(executed, false)
    executed = true
  })

  t.equal(executed, true)
})

t.test('.encapsulate() creates different sub-apps that can both define routes', (t) => {
  t.plan(9)

  const app = medley()
  var subApp1
  var subApp2

  app.encapsulate(function(subApp) {
    t.notEqual(subApp, app)
    subApp1 = subApp

    subApp.get('/first', (req, res) => {
      res.send('first')
    })
  })

  app.encapsulate(function(subApp) {
    t.notEqual(subApp, app)
    subApp2 = subApp

    subApp.get('/second', (req, res) => {
      res.send('second')
    })
  })

  t.notEqual(subApp1, subApp2)

  app.inject('/first', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'first')
  })

  app.inject('/second', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'second')
  })
})

t.test('.encapsulate() nested calls with prefix', (t) => {
  t.plan(4)

  const app = medley()

  app.encapsulate('/parent', (subApp) => {
    subApp.encapsulate('/child1', (subApp1) => {
      subApp1.get('/', (req, res) => {
        res.send('child 1')
      })
    })

    subApp.encapsulate('/child2', (subApp2) => {
      subApp2.get('/', (req, res) => {
        res.send('child 2')
      })
    })
  })

  app.inject('/parent/child1', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'child 1')
  })

  app.inject('/parent/child2', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'child 2')
  })
})
