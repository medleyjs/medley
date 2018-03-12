'use strict'

const nodeVersion = +process.version.match(/^v(\d+\.\d+)/)[1]

const testUtils = {
  supportsAsyncAwait: nodeVersion >= 7.6,
  supportsHTTP2: nodeVersion >= 8.4,
}

module.exports = testUtils
