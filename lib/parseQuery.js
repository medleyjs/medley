'use strict'

function parseQuery(url, queryParser) {
  var start = 0
  var i = 0

  for (var len = url.length; i < len; ++i) {
    var char = url.charCodeAt(i)
    if (char === 35 /* # */) {
      break
    }
    if (start === 0 && char === 63 /* ? */) {
      start = i + 1
    }
  }

  return start === 0 || start === i
    ? Object.create(null)
    : queryParser(url.slice(start, i))
}

module.exports = parseQuery
