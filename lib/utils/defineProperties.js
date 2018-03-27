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

function getDescriptor(property) {
  if (typeof property === 'function') {
    return Object.assign({value: property}, functionDescriptor)
  }

  if (typeof property === 'object' && property !== null) {
    return Object.assign({}, getterDescriptor, property)
  }

  return null
}

function defineProperties(target, properties) {
  for (const name in properties) {
    const property = properties[name]
    const descriptor = getDescriptor(property)

    if (descriptor === null) {
      target[name] = property
    } else {
      Object.defineProperty(target, name, descriptor)
    }
  }
}

module.exports = defineProperties
