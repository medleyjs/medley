'use strict'

function decorate(name, fn, dependencies) {
  if (checkExistence(this, name)) {
    throw new Error(`The decorator '${name}' has been already added!`)
  }

  if (dependencies) {
    checkDependencies(this, dependencies)
  }

  this[name] = fn
  return this
}

function checkExistence(app, name) {
  if (!name) {
    name = app
    app = this
  }
  return name in app
}

function checkExistenceInPrototype(klass, name) {
  return name in klass.prototype
}

function checkDependencies(app, deps) {
  for (var i = 0; i < deps.length; i++) {
    if (!checkExistence(app, deps[i])) {
      throw new Error(`medley decorator: missing dependency: '${deps[i]}'.`)
    }
  }
}

function decorateReply(name, fn, dependencies) {
  if (checkExistenceInPrototype(this._Reply, name)) {
    throw new Error(`The decorator '${name}' has been already added to Reply!`)
  }

  if (dependencies) {
    checkDependencies(this._Reply, dependencies)
  }

  this._Reply.prototype[name] = fn
  return this
}

function decorateRequest(name, fn, dependencies) {
  if (checkExistenceInPrototype(this._Request, name)) {
    throw new Error(`The decorator '${name}' has been already added to Request!`)
  }

  if (dependencies) {
    checkDependencies(this._Request, dependencies)
  }

  this._Request.prototype[name] = fn
  return this
}

module.exports = {
  add: decorate,
  exist: checkExistence,
  dependencies: checkDependencies,
  decorateReply,
  decorateRequest,
}
