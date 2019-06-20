'use strict'

const t = require('tap')
const medley = require('..')

t.test('.register() runs the plugin synchronously', (t) => {
  const app = medley()
  var run = false

  app.register(() => {
    t.equal(run, false)
    run = true
  })

  t.equal(run, true)
  t.end()
})

t.test('.register() passes the app and any options to the plugin', (t) => {
  const app = medley()

  app.register((appInstance, options) => {
    t.equal(appInstance, app)
    t.equal(options, undefined)
  })

  app.register((appInstance, options) => {
    t.equal(appInstance, app)
    t.equal(options, 'opts')
  }, 'opts')

  const opts = {a: 1}
  app.register((appInstance, options) => {
    t.equal(appInstance, app)
    t.equal(options, opts)
    t.strictDeepEqual(options, {a: 1})
  }, opts)

  t.end()
})

t.test('.register() works the same for sub-apps', (t) => {
  const app = medley()
  const subApp = app.createSubApp()

  subApp.register((appInstance, options) => {
    t.equal(appInstance, subApp)
    t.equal(options, undefined)
  })

  subApp.register((appInstance, options) => {
    t.equal(appInstance, subApp)
    t.equal(options, 'opts')
  }, 'opts')

  const opts = {a: 1}
  subApp.register((appInstance, options) => {
    t.equal(appInstance, subApp)
    t.equal(options, opts)
    t.strictDeepEqual(options, {a: 1})
  }, opts)

  t.end()
})

t.test('.register() should be chainable', (t) => {
  const app = medley()
  t.equal(app.register(() => {}), app)

  const subApp = app.createSubApp()
  t.equal(subApp.register(() => {}), subApp)

  t.end()
})
