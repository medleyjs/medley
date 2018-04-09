'use strict'

const t = require('tap')
const medley = require('..')

t.test('.register() runs the plugin immediately', (t) => {
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

/* eslint-disable padding-line-between-statements */

t.test('.register() checks dependencies before running the plugin', (t) => {
  t.plan(6)

  const app = medley()

  function plugin1() {
    t.pass('plugin1 should be registered')
  }
  plugin1.meta = {name: 'plugin1'}

  function plugin2() {
    t.pass('plugin2 should be registered')
  }
  plugin2.meta = {
    name: 'plugin2',
    dependencies: ['plugin1'],
  }

  function plugin3() {
    t.pass('plugin3 should be registered')
  }
  plugin3.meta = {
    name: 'plugin3',
    dependencies: ['plugin1', 'plugin2'],
  }

  function plugin4() {
    t.pass('plugin4 should be registered')
  }
  plugin4.meta = {
    // Missing name
    dependencies: ['plugin1', 'plugin3'],
  }

  function plugin5() {
    t.fail('plugin5 should not be registered')
  }
  plugin5.meta = {
    name: 'plugin5',
    dependencies: ['plugin1', 'plugin4'],
  }

  function plugin6() {
    t.fail('plugin6 should not be registered')
  }
  plugin6.meta = {dependencies: ['plugin5']}

  app.register(plugin1)
  app.register(plugin2)
  app.register(plugin3)
  app.register(plugin4)

  t.throws(
    () => app.register(plugin5),
    new Error("Could not register plugin 'plugin5' because dependency 'plugin4' was not registered")
  )

  t.throws(
    () => app.register(plugin6),
    new Error("Could not register plugin 'undefined' because dependency 'plugin5' was not registered")
  )
})

t.test('plugin dependency-checking should follow sub-app encapsulation', (t) => {
  t.plan(3)

  const app = medley()

  function plugin1() {
    t.pass('plugin1 should be registered')
  }
  plugin1.meta = {name: 'plugin1'}

  function plugin2() {
    t.pass('plugin2 should be registered')
  }
  plugin2.meta = {
    name: 'plugin2',
    dependencies: ['plugin1'],
  }

  function plugin3() {
    t.fail('plugin3 should not be registered')
  }
  plugin3.meta = {
    name: 'plugin3',
    dependencies: ['plugin1', 'plugin2'],
  }

  app.register(plugin1)

  app.encapsulate((subApp) => {
    subApp.register(plugin2)
  })

  app.encapsulate((subApp) => {
    t.throws(
      () => subApp.register(plugin3),
      new Error("Could not register plugin 'plugin3' because dependency 'plugin2' was not registered")
    )
  })
})
