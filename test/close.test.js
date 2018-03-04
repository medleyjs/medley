'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('close callback', (t) => {
  t.plan(4)
  const app = medley()
  app.addHook('onClose', onClose)

  function onClose(subApp, done) {
    t.type(app, subApp)
    done()
  }

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.ok('close callback')
    })
  })
})

test('inside register', (t) => {
  t.plan(5)
  const app = medley()
  app.register(function(f, opts, next) {
    f.addHook('onClose', onClose)

    function onClose(subApp, done) {
      t.ok(subApp.prototype === app.prototype)
      t.strictEqual(subApp, f)
      done()
    }

    next()
  })

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.ok('close callback')
    })
  })
})

test('close order', (t) => {
  t.plan(5)
  const app = medley()
  const order = [1, 2, 3]

  app.register(function(f, opts, next) {
    f.addHook('onClose', (subApp, done) => {
      t.is(order.shift(), 1)
      done()
    })

    next()
  })

  app.addHook('onClose', (subApp, done) => {
    t.is(order.shift(), 2)
    done()
  })

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
      t.is(order.shift(), 3)
    })
  })
})

test('should not throw an error if the server is not listening', (t) => {
  t.plan(2)
  const app = medley()
  app.addHook('onClose', onClose)

  function onClose(subApp, done) {
    t.type(app, subApp)
    done()
  }

  app.close((err) => {
    t.error(err)
  })
})

test('onClose should keep the context', (t) => {
  t.plan(4)
  const app = medley()
  app.register(plugin)

  function plugin(subApp, opts, next) {
    subApp.decorate('test', true)
    subApp.addHook('onClose', onClose)
    t.ok(subApp.prototype === app.prototype)

    function onClose(i, done) {
      t.ok(i.test)
      t.strictEqual(i, subApp)
      done()
    }

    next()
  }

  app.close((err) => {
    t.error(err)
  })
})
