'use strict'

const functionDescriptor = {
  configurable: true,
  enumerable: false,
  writable: true,
}
const getterDescriptor = {
  configurable: true,
  enumerable: false,
}

function defineProperties(object, properties) {
  for (const name in properties) {
    const property = properties[name]
    const descriptor = typeof property === 'function'
      ? Object.assign({value: property}, functionDescriptor)
      : Object.assign({}, getterDescriptor, property)

    Object.defineProperty(object, name, descriptor)
  }
}

module.exports = defineProperties
