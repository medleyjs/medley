'use strict'

const assert = require('assert')
const registeredPlugins = Symbol.for('registered-plugin')

function getMeta(fn) {
  return fn[Symbol.for('plugin-meta')]
}

function shouldSkipOverride(fn) {
  return !!fn[Symbol.for('skip-override')]
}

function checkDependencies(fn) {
  const meta = getMeta(fn)
  if (!meta) {
    return
  }

  const dependencies = meta.dependencies
  if (!dependencies) {
    return
  }
  assert(Array.isArray(dependencies), 'The dependencies should be an array of strings')

  dependencies.forEach((dependency) => {
    assert(
      this[registeredPlugins].indexOf(dependency) > -1,
      `The dependency '${dependency}' is not registered`
    )
  })
}

function checkDecorators(fn) {
  const meta = getMeta(fn)
  if (!meta) {
    return
  }

  const decorators = meta.decorators
  if (!decorators) {
    return
  }

  if (decorators.medley) {
    _checkDecorators.call(this, 'medley', decorators.medley)
  }
  if (decorators.reply) {
    _checkDecorators.call(this._Reply, 'Reply', decorators.reply)
  }
  if (decorators.request) {
    _checkDecorators.call(this._Request, 'Request', decorators.request)
  }
}

function _checkDecorators(objectName, decorators) {
  assert(Array.isArray(decorators), 'The decorators should be an array of strings')

  decorators.forEach((decorator) => {
    assert(
      objectName === 'medley' ? decorator in this : decorator in this.prototype,
      `The decorator '${decorator}' is not present in ${objectName}`
    )
  })
}

function registerPluginName(fn) {
  const meta = getMeta(fn)
  if (!meta) {
    return
  }

  const name = meta.name
  if (!name) {
    return
  }
  this[registeredPlugins].push(name)
}

function registerPlugin(fn) {
  registerPluginName.call(this, fn)
  checkDecorators.call(this, fn)
  checkDependencies.call(this, fn)
  return shouldSkipOverride(fn)
}

module.exports = {
  registeredPlugins,
  registerPlugin,
}

module.exports[Symbol.for('internals')] = {
  shouldSkipOverride,
  getMeta,
  checkDecorators,
  checkDependencies,
}
