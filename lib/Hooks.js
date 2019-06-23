'use strict'

const hookNames = [
  'onRequest',
  'onSend',
  'onFinished',
]

class Hooks {
  constructor(oldHooks) {
    this.onRequest = oldHooks ? oldHooks.onRequest.slice() : []
    this.onSend = oldHooks ? oldHooks.onSend.slice() : []
    this.onFinished = oldHooks ? oldHooks.onFinished.slice() : []
  }

  add(hookName, fn) {
    if (typeof hookName !== 'string') {
      throw new TypeError('The hook name must be a string')
    }

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

    this[hookName].push(fn)
  }

  clone() {
    return new Hooks(this)
  }
}

module.exports = Hooks
