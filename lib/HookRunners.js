'use strict'

const HookRunners = {
  onRequestPreHandlerHookRunner(functions, reply, onComplete) {
    var i = 0

    function next(err) {
      if (err) {
        reply.error(err)
        return
      }

      if (i === functions.length) {
        onComplete(reply)
        return
      }

      const result = functions[i++](reply._request, reply, next)
      if (result && typeof result.then === 'function') {
        result.catch(handleReject)
      }
    }

    function handleReject(err) {
      reply.error(err)
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

      const result = functions[i++](reply._request, reply, payload, next)
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
