'use strict'

const lru = require('tiny-lru')

class BodyParser {
  constructor() {
    this.parsers = []
    this.catchAllParser = null
    this.cache = lru(50)
  }

  clone() {
    const bodyParser = new BodyParser()
    bodyParser.parsers = this.parsers.slice()
    bodyParser.catchAllParser = this.catchAllParser
    return bodyParser
  }

  add(contentType, parserFn) {
    if (typeof contentType !== 'string' || contentType === '') {
      throw new TypeError('The content type must be a string and cannot be empty')
    }
    if (typeof parserFn !== 'function') {
      throw new TypeError(`The parser argument must be a function. Got: ${parserFn}`)
    }

    if (contentType === '*') {
      this.catchAllParser = parserFn
    } else {
      this.parsers.push({contentType, parserFn})
    }
  }

  getParser(contentType) {
    const {parsers} = this

    for (var i = 0; i < parsers.length; i++) {
      if (contentType.indexOf(parsers[i].contentType) >= 0) {
        var parser = parsers[i].parserFn
        this.cache.set(contentType, parser)
        return parser
      }
    }

    return this.catchAllParser
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
