'use strict'

function sendError(err) {
  this.error(err)
}

function handleOnSendError(err) {
  this.sent = false
  this.error(err)
}

const HookRunners = {
  onRequestPreHandlerHookRunner(functions, res, onComplete) {
    var handleReject = sendError.bind(res)
    var i = 0

    function next(err) {
      if (err) {
        res.error(err)
        return
      }

      if (i === functions.length) {
        onComplete(res)
        return
      }

      const result = functions[i++](res.request, res, next)
      if (result && typeof result.then === 'function') {
        result.then(handleResolve, handleReject)
      }
    }

    function handleResolve() {
      if (!res.sent) {
        next(null)
      }
    }

    next(null)
  },

  onSendHookRunner(functions, res, payload, onComplete) {
    var handleError = handleOnSendError.bind(res)
    var i = 0

    function next(err, newPayload) {
      if (err) {
        handleError(err)
        return
      }

      if (newPayload !== undefined) {
        payload = newPayload
      }

      if (i === functions.length) {
        onComplete(res, payload)
        return
      }

      const result = functions[i++](res.request, res, payload, next)
      if (result && typeof result.then === 'function') {
        result.then(handleResolve, handleError)
      }
    }

    function handleResolve(newPayload) {
      next(null, newPayload)
    }

    next(null, undefined)
  },
}

module.exports = HookRunners
