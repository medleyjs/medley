'use strict'

function runOnCloseHandlers(handlers, cb) {
  const errors = []
  var i = 0;

  (function next(err) {
    if (err) {
      errors.push(err)
    }

    if (i === handlers.length) {
      switch (errors.length) {
        case 0:
          cb(null)
          return
        case 1:
          cb(errors[0])
          return
        default:
          cb(errors)
          return
      }
    }

    const ret = handlers[i++](next)
    if (ret && typeof ret.then === 'function') {
      ret.then(next, next)
    }
  })(null)
}

module.exports = runOnCloseHandlers
