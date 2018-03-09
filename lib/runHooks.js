'use strict'

function runHooks(functions, runner, state, cb) {
  var i = 0

  function next(err) {
    if (err || i === functions.length) {
      cb(err, state)
      return
    }

    const result = runner(functions[i++], state, next)
    if (result && typeof result.then === 'function') {
      result.catch(handleReject)
    }
  }

  function handleReject(err) {
    cb(err, state)
  }

  next(null)
}

module.exports = runHooks
