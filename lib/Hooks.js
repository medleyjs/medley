'use strict'

const {defaultErrorHandler} = require('./RequestHandlers')

const hookNames = [
  'onRequest',
  'onSend',
  'onFinished',
  'onError',
]

class Hooks {
  constructor(oldHooks) {
    this.onRequest = oldHooks ? oldHooks.onRequest.slice() : []
    this.onSend = oldHooks ? oldHooks.onSend.slice() : []
    this.onFinished = oldHooks ? oldHooks.onFinished.slice() : []
    this.onError = oldHooks ? oldHooks.onError.slice() : [defaultErrorHandler]
  }

  add(hookName, fn) {
    if (hookNames.indexOf(hookName) === -1) {
      throw new Error(
        `'${hookName}' is not a valid hook name. Valid hooks are: ${
          hookNames.map(hook => `'${hook}'`).join(', ')
        }`
      )
    }

    if (typeof fn !== 'function') {
      throw new TypeError('The hook callback must be a function')
    }

    if (hookName === 'onError') { // Ensure the default error handler is always the last hook
      this.onError[this.onError.length - 1] = fn
      this.onError.push(defaultErrorHandler)
    } else {
      this[hookName].push(fn)
    }
  }

  clone() {
    return new Hooks(this)
  }
}

module.exports = Hooks
