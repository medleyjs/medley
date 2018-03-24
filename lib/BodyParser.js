'use strict'

const compileMimeMatch = require('compile-mime-match')
const lru = require('tiny-lru')

class BodyParser {
  constructor() {
    this.parsers = []
    this.cache = lru(50)
  }

  clone() {
    const bodyParser = new BodyParser()
    bodyParser.parsers = this.parsers.slice()
    return bodyParser
  }

  add(contentType, parser) {
    if (typeof parser !== 'function') {
      throw new TypeError(`The parser argument must be a function. Got: ${parser}`)
    }

    const contentTypeMatch = typeof contentType === 'function'
      ? contentType
      : compileMimeMatch(contentType)

    this.parsers.push({contentTypeMatch, parser})
  }

  getParser(contentType) {
    const {parsers} = this

    for (var i = 0; i < parsers.length; i++) {
      if (parsers[i].contentTypeMatch(contentType) === true) {
        var {parser} = parsers[i]
        this.cache.set(contentType, parser)
        return parser
      }
    }

    return null
  }

  run(contentType = '', req, res, runPreHandlerHooks) {
    const parser = this.cache.get(contentType) || this.getParser(contentType)

    if (parser === null) {
      res.error(415, new Error('Unsupported Media Type: ' + contentType))
      return
    }

    const result = parser(req, done)
    if (result && typeof result.then === 'function') {
      result.then(body => done(null, body), done)
    }

    function done(error, body) {
      if (error) {
        res.error(error)
      } else {
        req.body = body
        runPreHandlerHooks(res)
      }
    }
  }
}

module.exports = BodyParser
