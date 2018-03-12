'use strict'

const t = require('tap')
const defineProperties = require('../../lib/utils/defineProperties')

t.test('should define functions', (t) => {
  const obj = {}
  const properties = {
    fn() {},
    arrowFn: () => {},
  }

  defineProperties(obj, properties)

  t.equal(obj.fn, properties.fn)
  t.equal(obj.arrowFn, properties.arrowFn)
  t.strictDeepEqual(Object.getOwnPropertyDescriptor(obj, 'fn'), {
    value: properties.fn,
    configurable: true,
    enumerable: false,
    writable: true,
  })
  t.strictDeepEqual(Object.getOwnPropertyDescriptor(obj, 'arrowFn'), {
    value: properties.arrowFn,
    configurable: true,
    enumerable: false,
    writable: true,
  })

  t.end()
})

t.test('should define getters', (t) => {
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
  t.strictDeepEqual(Object.getOwnPropertyDescriptor(obj, 'two'), {
    get: properties.two.get,
    set: undefined,
    configurable: true,
    enumerable: false,
  })

  t.end()
})

t.test('should define getters and setters', (t) => {
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
  t.strictDeepEqual(Object.getOwnPropertyDescriptor(obj, 'value'), {
    get: properties.value.get,
    set: properties.value.set,
    configurable: true,
    enumerable: false,
  })

  t.end()
})

t.test('should define regular properties', (t) => {
  const obj = {}
  const properties = {
    string: 'a',
    nul: null,
  }

  defineProperties(obj, properties)

  t.equal(obj.string, 'a')
  t.equal(obj.nul, null)
  t.strictDeepEqual(Object.getOwnPropertyDescriptor(obj, 'string'), {
    value: 'a',
    configurable: true,
    enumerable: true,
    writable: true,
  })
  t.strictDeepEqual(Object.getOwnPropertyDescriptor(obj, 'nul'), {
    value: null,
    configurable: true,
    enumerable: true,
    writable: true,
  })

  t.end()
})
