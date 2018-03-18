'use strict'

const assert = require('assert')

const kRegisteredPlugins = Symbol('registered-plugins')

function checkDependencies(app, plugin) {
  const {meta} = plugin
  if (!meta) {
    return
  }

  const {dependencies} = meta
  if (!dependencies) {
    return
  }
  assert(Array.isArray(dependencies), 'The dependencies should be an array of strings')

  dependencies.forEach((dependency) => {
    assert(
      app[kRegisteredPlugins].indexOf(dependency) >= 0,
      `Could not register plugin '${meta.name}' because dependency '${dependency}' was not registered`
    )
  })
}

function registerPluginName(app, plugin) {
  const {meta} = plugin
  if (!meta || !meta.name || app[kRegisteredPlugins].indexOf(meta.name) >= 0) {
    return
  }
  app[kRegisteredPlugins].push(meta.name)
}

// Gets attached to the app so 'this' is the app instance
function registerPlugin(plugin, options) {
  checkDependencies(this, plugin)
  registerPluginName(this, plugin)
  plugin(this, options)
}

function decorateApp(app) {
  app.decorate(kRegisteredPlugins, [])
  app.decorate('registerPlugin', registerPlugin)
}

module.exports = {
  decorateApp,
}
