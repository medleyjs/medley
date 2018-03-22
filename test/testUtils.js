'use strict'

const nodeVersionMajor = +process.version.match(/^v(\d+)/)[1]
const nodeVersionMinor = +process.version.match(/^v\d+\.(\d+)/)[1]

const testUtils = {
  supportsAsyncAwait: nodeVersionMajor >= 7 && nodeVersionMinor >= 6,
  supportsHTTP2: nodeVersionMajor >= 8 && nodeVersionMinor >= 8,
}

module.exports = testUtils
