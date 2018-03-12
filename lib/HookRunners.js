'use strict'

const HookRunners = {
  onRequestPreHandlerHookRunner(functions, response, onComplete) {
    var i = 0

    function next(err) {
      if (err) {
        response.error(err)
        return
      }

      if (i === functions.length) {
        onComplete(response)
        return
      }

      const result = functions[i++](response._request, response, next)
      if (result && typeof result.then === 'function') {
        result.catch(handleReject)
      }
    }

    function handleReject(err) {
      response.error(err)
    }

    next(null)
  },

  onSendHookRunner(functions, response, payload, cb) {
    var i = 0

    function next(err, newPayload) {
      if (err) {
        cb(err, response, null)
        return
      }

      if (newPayload !== undefined) {
        payload = newPayload
      }

      if (i === functions.length) {
        cb(null, response, payload)
        return
      }

      const result = functions[i++](response._request, response, payload, next)
      if (result && typeof result.then === 'function') {
        result.catch(handleReject)
      }
    }

    function handleReject(err) {
      cb(err, response, null)
    }

    next()
  },
}

module.exports = HookRunners
