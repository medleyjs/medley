'use strict'

function runOnLoadHandlers(handlers, cb) {
  var i = 0

  function next(err) {
    if (err || i === handlers.length) {
      cb(err)
      return
    }

    const ret = handlers[i++](next)
    if (ret && typeof ret.then === 'function') {
      ret.then(handleResolve, handleReject)
    }
  }

  function handleResolve() {
    next(null)
  }

  function handleReject(err) {
    cb(err || new Error(`Promise threw non-error: ${JSON.stringify(err)}`))
  }

  next(null)
}

module.exports = runOnLoadHandlers
