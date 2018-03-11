'use strict'

const nodeVersion = +process.version.match(/^v(\d+\.\d+)/)[1]

const testUtils = {
  supportsAsyncAwait: nodeVersion >= 7.6,
  supportsGetOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor === 'function',
}

module.exports = testUtils
