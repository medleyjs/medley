'use strict'

const t = require('tap')
const defineProperties = require('../../lib/utils/defineProperties')

const {supportsGetOwnPropertyDescriptor} = require('../testUtils')

t.test('should define functions', (t) => {
  t.plan(supportsGetOwnPropertyDescriptor ? 3 : 2)

  const obj = {}
  const properties = {
    fn() {},
    arrowFn: () => {},
  }

  defineProperties(obj, properties)

  t.equal(obj.fn, properties.fn)
  t.equal(obj.arrowFn, properties.arrowFn)

  if (!supportsGetOwnPropertyDescriptor) {
    return
  }

  t.strictDeepEqual(Object.getOwnPropertyDescriptors(obj), {
    fn: {
      value: properties.fn,
      configurable: true,
      enumerable: false,
      writable: true,
    },
    arrowFn: {
      value: properties.arrowFn,
      configurable: true,
      enumerable: false,
      writable: true,
    },
  })
})

t.test('should define getters', (t) => {
  t.plan(supportsGetOwnPropertyDescriptor ? 2 : 1)

  const obj = {}
  const properties = {
    two: {
      get() {
        return 2
      },
    },
  }

  defineProperties(obj, properties)

  t.equal(obj.two, 2)

  if (!supportsGetOwnPropertyDescriptor) {
    return
  }

  t.strictDeepEqual(Object.getOwnPropertyDescriptors(obj), {
    two: {
      get: properties.two.get,
      set: undefined,
      configurable: true,
      enumerable: false,
    },
  })
})

t.test('should define getters and setters', (t) => {
  t.plan(supportsGetOwnPropertyDescriptor ? 3 : 2)

  const obj = {_value: 0}
  const properties = {
    value: {
      get() {
        return this._value
      },
      set(value) {
        this._value = value
      },
    },
  }

  defineProperties(obj, properties)

  t.equal(obj.value, 0)
  obj.value = 2
  t.equal(obj.value, 2)

  if (!supportsGetOwnPropertyDescriptor) {
    return
  }

  t.strictDeepEqual(Object.getOwnPropertyDescriptors(obj), {
    _value: {
      value: obj.value,
      configurable: true,
      enumerable: true,
      writable: true,
    },
    value: {
      get: properties.value.get,
      set: properties.value.set,
      configurable: true,
      enumerable: false,
    },
  })
})
