'use strict'

const t = require('tap')
const test = t.test

const {
  onRequestPreHandlerHookRunner: runOnReqHooks,
  onSendHookRunner: runOnSendHooks,
} = require('../../lib/HookRunners')

test('onRequestPreHandlerHookRunner - Basic', (t) => {
  t.plan(8)

  const originalState = {a: 'a', b: 'b'}

  runOnReqHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state.a, state.b, next)
  }

  function fn1(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    next()
  }

  function fn2(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    next()
  }

  function fn3(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    next()
  }

  function done(err, state) {
    t.error(err)
    t.strictEqual(state, originalState)
  }
})

test('onRequestPreHandlerHookRunner - In case of error should skip to done', (t) => {
  t.plan(6)

  const originalState = {a: 'a', b: 'b'}

  runOnReqHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state.a, state.b, next)
  }

  function fn1(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    next()
  }

  function fn2(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    next(new Error('kaboom'))
  }

  function fn3() {
    t.fail('We should not be here')
  }

  function done(err, state) {
    t.strictEqual(err.message, 'kaboom')
    t.strictEqual(state, originalState)
  }
})

function asyncFunc() {
  return new Promise(resolve => setImmediate(resolve))
}

test('onRequestPreHandlerHookRunner - Should handle async functions', (t) => {
  t.plan(8)

  const originalState = {a: 'a', b: 'b'}

  runOnReqHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state.a, state.b, next)
  }

  async function fn1(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    await asyncFunc()
    next()
  }

  async function fn2(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    await asyncFunc()
    next()
  }

  async function fn3(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    await asyncFunc()
    next()
  }

  function done(err, state) {
    t.error(err)
    t.strictEqual(state, originalState)
  }
})

test('onRequestPreHandlerHookRunner - Should catch rejected primises and skip to done', (t) => {
  t.plan(6)

  const originalState = {a: 'a', b: 'b'}

  runOnReqHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state.a, state.b, next)
  }

  async function fn1(a, b, next) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    await asyncFunc()
    next()
  }

  async function fn2(a, b) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    await asyncFunc()
    throw new Error('kaboom')
  }

  function fn3() {
    t.fail('We should not be here')
  }

  function done(err, state) {
    t.strictEqual(err.message, 'kaboom')
    t.strictEqual(state, originalState)
  }
})

test('onRequestPreHandlerHookRunner - Hooks do not continue if next() is never called', (t) => {
  t.plan(1)

  const originalState = {a: 'a', b: 'b'}

  runOnReqHooks([fn1, fn2], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state, next)
  }

  async function fn1(state) {
    t.strictEqual(state, originalState)
    await asyncFunc()
    return undefined
  }

  function fn2() {
    t.fail('this should not be called')
  }

  function done() {
    t.fail('this should not be called')
  }
})

test('onRequestPreHandlerHookRunner - Promises that resolve to a value do not change the state', (t) => {
  t.plan(5)

  const originalState = {a: 'a', b: 'b'}

  runOnReqHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state, next)
  }

  async function fn1(state, next) {
    t.strictEqual(state, originalState)
    await asyncFunc()
    next()
    return null
  }

  async function fn2(state, next) {
    t.strictEqual(state, originalState)
    await asyncFunc()
    next()
    return 'string'
  }

  async function fn3(state, next) {
    t.strictEqual(state, originalState)
    await asyncFunc()
    next()
    return {object: true}
  }

  function done(err, state) {
    t.error(err)
    t.strictEqual(state, originalState)
  }
})

test('onSendHookRunner - Basic', (t) => {
  t.plan(12)

  const originalReply = {request: {}}
  const originalPayload = 'payload'

  runOnSendHooks([fn1, fn2, fn3], originalReply, originalPayload, done)

  function fn1(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
    next()
  }

  function fn2(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
    next()
  }

  function fn3(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
    next()
  }

  function done(err, reply, payload) {
    t.error(err)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
  }
})

test('onSendHookRunner - Can change the payload', (t) => {
  t.plan(12)

  const originalReply = {request: {}}
  const v1 = {hello: 'world'}
  const v2 = {ciao: 'mondo'}
  const v3 = {winter: 'is coming'}
  const v4 = {winter: 'has come'}

  runOnSendHooks([fn1, fn2, fn3], originalReply, v1, done)

  function fn1(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v1)
    next(null, v2)
  }

  function fn2(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v2)
    next(null, v3)
  }

  function fn3(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v3)
    next(null, v4)
  }

  function done(err, reply, payload) {
    t.error(err)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v4)
  }
})

test('onSendHookRunner - In case of error should skip to done', (t) => {
  t.plan(9)

  const originalReply = {request: {}}
  const v1 = {hello: 'world'}
  const v2 = {ciao: 'mondo'}

  runOnSendHooks([fn1, fn2, fn3], originalReply, v1, done)

  function fn1(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v1)
    next(null, v2)
  }

  function fn2(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v2)
    next(new Error('kaboom'))
  }

  function fn3() {
    t.fail('We should not be here')
  }

  function done(err, reply, payload) {
    t.strictEqual(err.message, 'kaboom')
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, null)
  }
})

test('onSendHookRunner - Should handle promises', (t) => {
  t.plan(12)

  const originalReply = {request: {}}
  const originalPayload = 'hello world'

  runOnSendHooks([fn1, fn2, fn3], originalReply, originalPayload, done)

  function fn1(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
    return Promise.resolve().then(next)
  }

  function fn2(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
    return Promise.resolve().then(next)
  }

  function fn3(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
    return Promise.resolve().then(next)
  }

  function done(err, reply, payload) {
    t.error(err)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, originalPayload)
  }
})

test('onSendHookRunner - In case of error should skip to done (with promises)', (t) => {
  t.plan(9)

  const originalReply = {request: {}}
  const v1 = {hello: 'world'}
  const v2 = {ciao: 'mondo'}

  runOnSendHooks([fn1, fn2, fn3], originalReply, v1, done)

  function fn1(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v1)
    return Promise.resolve().then(() => next(null, v2))
  }

  function fn2(request, reply, payload) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v2)
    return Promise.reject(new Error('kaboom'))
  }

  function fn3() {
    t.fail('We should not be here')
  }

  function done(err, reply, payload) {
    t.strictEqual(err.message, 'kaboom')
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, null)
  }
})

test('onSendHookRunner - Be able to exit before its natural end', (t) => {
  t.plan(6)

  const originalReply = {request: {}}
  const v1 = {hello: 'world'}
  const v2 = {ciao: 'mondo'}

  runOnSendHooks([fn1, fn2, fn3], originalReply, v1, done)

  function fn1(request, reply, payload, next) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v1)
    next(null, v2)
  }

  function fn2(request, reply, payload) {
    t.strictEqual(request, originalReply.request)
    t.strictEqual(reply, originalReply)
    t.strictEqual(payload, v2)
  }

  function fn3() {
    t.fail('this should not be called')
  }

  function done() {
    t.fail('this should not be called')
  }
})
