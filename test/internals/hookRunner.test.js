'use strict'

const t = require('tap')
const test = t.test
const runHooks = require('../../lib/hookRunner')

test('hookRunner - Basic', (t) => {
  t.plan(8)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

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

test('hookRunner - In case of error should skip to done', (t) => {
  t.plan(6)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

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

test('hookRunner - Should handle promises', (t) => {
  t.plan(8)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state.a, state.b, next)
  }

  function fn1(a, b) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    return Promise.resolve()
  }

  function fn2(a, b) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    return Promise.resolve()
  }

  function fn3(a, b) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    return Promise.resolve()
  }

  function done(err, state) {
    t.error(err)
    t.strictEqual(state, originalState)
  }
})

test('hookRunner - In case of error should skip to done (with promises)', (t) => {
  t.plan(6)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state.a, state.b, next)
  }

  function fn1(a, b) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    return Promise.resolve()
  }

  function fn2(a, b) {
    t.strictEqual(a, 'a')
    t.strictEqual(b, 'b')
    return Promise.reject(new Error('kaboom'))
  }

  function fn3() {
    t.fail('We should not be here')
  }

  function done(err, state) {
    t.strictEqual(err.message, 'kaboom')
    t.strictEqual(state, originalState)
  }
})

test('hookRunner - Be able to exit before its natural end', (t) => {
  t.plan(2)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    if (state.stop) {
      return undefined
    }
    return fn(state, next)
  }

  function fn1(state, next) {
    t.strictEqual(state, originalState)
    next()
  }

  function fn2(state) {
    t.strictEqual(state, originalState)
    state.stop = true
    return Promise.resolve()
  }

  function fn3() {
    t.fail('this should not be called')
  }

  function done() {
    t.fail('this should not be called')
  }
})

test('hookRunner - Promises that resolve to a value do not change the state', (t) => {
  t.plan(5)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

  function iterator(fn, state, next) {
    return fn(state, next)
  }

  function fn1(state) {
    t.strictEqual(state, originalState)
    return Promise.resolve(null)
  }

  function fn2(state) {
    t.strictEqual(state, originalState)
    return Promise.resolve('string')
  }

  function fn3(state) {
    t.strictEqual(state, originalState)
    return Promise.resolve({object: true})
  }

  function done(err, state) {
    t.error(err)
    t.strictEqual(state, originalState)
  }
})
