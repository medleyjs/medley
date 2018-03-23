'use strict'

const lru = require('tiny-lru')

function BodyParser() {
  this.customParsers = {}
  this.parserList = []
  this.cache = lru(50)
}

BodyParser.prototype.clone = function() {
  const bodyParser = new BodyParser()
  Object.assign(bodyParser.customParsers, this.customParsers)
  bodyParser.parserList = this.parserList.slice()
  return bodyParser
}

BodyParser.prototype.add = function(contentType, parserFn) {
  if (typeof contentType !== 'string' || contentType === '') {
    throw new TypeError('The content type must be a string and cannot be empty')
  }
  if (typeof parserFn !== 'function') {
    throw new TypeError(`The parser argument must be a function. Got: ${parserFn}`)
  }
  if (this.hasParser(contentType)) {
    throw new Error(`Body parser for content type '${contentType}' already present.`)
  }

  if (contentType === '*') {
    this.parserList.push('')
    this.customParsers[''] = parserFn
  } else {
    this.parserList.unshift(contentType)
    this.customParsers[contentType] = parserFn
  }
}

BodyParser.prototype.hasParser = function(contentType) {
  return contentType in this.customParsers
}

BodyParser.prototype.getParser = function(contentType) {
  for (var i = 0; i < this.parserList.length; i++) {
    if (contentType.indexOf(this.parserList[i]) > -1) {
      var parser = this.customParsers[this.parserList[i]]
      this.cache.set(contentType, parser)
      return parser
    }
  }

  return this.customParsers['']
}

BodyParser.prototype.run = function(contentType = '', req, res, runPreHandlerHooks) {
  const parser = this.cache.get(contentType) || this.getParser(contentType)

  if (parser === undefined) {
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

module.exports = BodyParser
