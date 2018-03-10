'use strict'

const HookRunners = {
  onRequestPreHandlerHookRunner(functions, runner, state, cb) {
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
  },

  onSendHookRunner(functions, reply, payload, cb) {
    var i = 0

    function next(err, newPayload) {
      if (err) {
        cb(err, reply, null)
        return
      }

      if (newPayload !== undefined) {
        payload = newPayload
      }

      if (i === functions.length) {
        cb(null, reply, payload)
        return
      }

      const result = functions[i++](reply.request, reply, payload, next)
      if (result && typeof result.then === 'function') {
        result.catch(handleReject)
      }
    }

    function handleReject(err) {
      cb(err, reply, null)
    }

    next()
  },
}

module.exports = HookRunners
