'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('close callback', (t) => {
  t.plan(4)
  const app = medley()
  app.onClose(onClose)

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

test('inside a sub-app', (t) => {
  t.plan(4)

  const app = medley()

  app.use(function(subApp) {
    subApp.onClose(function(_subApp, done) {
      t.ok(_subApp.prototype === app.prototype)
      t.strictEqual(_subApp, subApp)
      done()
    })
  })

  app.listen(0, (err) => {
    t.error(err)

    app.close((err) => {
      t.error(err)
    })
  })
})

// TODO: Fix this
// test('close order', (t) => {
//   t.plan(5)
//   const app = medley()
//   const order = [1, 2, 3]

//   app.use(function(subApp) {
//     subApp.onClose((_, done) => {
//       t.is(order.shift(), 1)
//       done()
//     })
//   })

//   app.onClose((_, done) => {
//     t.is(order.shift(), 2)
//     done()
//   })

//   app.listen(0, (err) => {
//     t.error(err)

//     app.close((err) => {
//       t.error(err)
//       t.is(order.shift(), 3)
//     })
//   })
// })

test('should not throw an error if the server is not listening', (t) => {
  t.plan(2)
  const app = medley()
  app.onClose(onClose)

  function onClose(subApp, done) {
    t.type(app, subApp)
    done()
  }

  app.close((err) => {
    t.error(err)
  })
})
