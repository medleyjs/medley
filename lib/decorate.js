'use strict'

function decorateApp(name, fn) {
  if (name in this) {
    throw new Error(`The decorator '${name}' has been already added!`)
  }

  this[name] = fn
  return this
}

function checkExistenceInPrototype(klass, name) {
  return name in klass.prototype
}

function decorateReply(name, fn) {
  if (checkExistenceInPrototype(this._Reply, name)) {
    throw new Error(`The decorator '${name}' has been already added to Reply!`)
  }

  this._Reply.prototype[name] = fn
  return this
}

function decorateRequest(name, fn) {
  if (checkExistenceInPrototype(this._Request, name)) {
    throw new Error(`The decorator '${name}' has been already added to Request!`)
  }

  this._Request.prototype[name] = fn
  return this
}

module.exports = {
  decorateApp,
  decorateReply,
  decorateRequest,
}
