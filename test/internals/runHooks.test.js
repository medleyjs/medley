'use strict'

const t = require('tap')
const test = t.test
const runHooks = require('../../lib/runHooks')

test('runHooks - Basic', (t) => {
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

test('runHooks - In case of error should skip to done', (t) => {
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

function asyncFunc() {
  return new Promise(resolve => setImmediate(resolve))
}

test('runHooks - Should handle async functions', (t) => {
  t.plan(8)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

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

test('runHooks - Should catch rejected primises and skip to done', (t) => {
  t.plan(6)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

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

test('runHooks - Hooks do not continue if next() is never called', (t) => {
  t.plan(1)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2], iterator, originalState, done)

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

test('runHooks - Promises that resolve to a value do not change the state', (t) => {
  t.plan(5)

  const originalState = {a: 'a', b: 'b'}

  runHooks([fn1, fn2, fn3], iterator, originalState, done)

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
