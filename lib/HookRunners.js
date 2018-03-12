'use strict'

function sendError(err) {
  this.error(err)
}

const HookRunners = {
  onRequestPreHandlerHookRunner(functions, response, onComplete) {
    var handleReject = sendError.bind(response)
    var i = 0;

    (function next(err) {
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
    })(null)
  },

  onSendHookRunner(functions, response, payload, cb) {
    var i = 0

    function handleReject(err) {
      cb(err, response, null)
    }

    (function next(err, newPayload) {
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
    })(null)
  },
}

module.exports = HookRunners
