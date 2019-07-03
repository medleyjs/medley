'use strict'

function runOnRequestHooks(hooks, req, res, done) {
  var handleResolve = null
  var i = 0;

  (function next(err) {
    if (err) {
      runOnErrorHooks(err, res)
      return
    }

    if (i === hooks.length) {
      done(res)
      return
    }

    const result = hooks[i++](req, res, next)

    if (result && typeof result.then === 'function') {
      if (handleResolve === null) {
        handleResolve = function(value) {
          if (value !== false) {
            next(undefined)
          }
        }
      }
      result.then(handleResolve, next)
    }
  })(undefined)
}

function runOnSendHooks(res, body, done) {
  const hooks = res._route.onSendHooks
  const req = res.request
  var handleResolve = null
  var i = 0;

  (function next(err, newBody) {
    if (err) {
      res._route.onErrorSending(err, res)
    } else if (newBody !== undefined) {
      body = newBody
    }

    if (i === hooks.length) {
      done(res, body)
      return
    }

    const result = hooks[i++](req, res, body, next)

    if (result && typeof result.then === 'function') {
      if (handleResolve === null) {
        handleResolve = function(value) {
          next(undefined, value)
        }
      }
      result.then(handleResolve, next)
    }
  })(undefined, undefined)
}

function runOnErrorHooks(error, res) {
  const hooks = res._route.onErrorHooks
  const req = res.request
  var handleResolve = null
  var i = 0

  // Remove the current Content-Type so .send() doesn't assume the old type
  res.removeHeader('content-type');

  (function next(err) {
    if (err) {
      if (res.sent) {
        throw err // Re-throw the error since it is a system error
      }
      error = err // Update error
    }

    const result = hooks[i++](error, req, res, next)

    if (result && typeof result.then === 'function') {
      if (handleResolve === null) {
        handleResolve = function(body) {
          if (body === undefined) {
            next(undefined)
          } else {
            res.send(body)
          }
        }
      }
      result.then(handleResolve, next)
    }
  })(undefined)
}

module.exports = {
  runOnRequestHooks,
  runOnSendHooks,
  runOnErrorHooks,
}
