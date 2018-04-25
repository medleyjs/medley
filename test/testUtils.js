'use strict'

const major = +process.version.match(/^v(\d+)/)[1]
const minor = +process.version.match(/^v\d+\.(\d+)/)[1]

const testUtils = {
  supportsAsyncAwait: major > 7 || major === 7 && minor >= 6,
  supportsHTTP2: major > 8 || major === 8 && minor >= 8,
}

module.exports = testUtils
