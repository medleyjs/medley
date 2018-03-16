'use strict'

const lru = require('tiny-lru')

function BodyParser(bodyLimit) {
  this.bodyLimit = bodyLimit
  this.customParsers = {
    'application/json': new Parser(true, false, bodyLimit, defaultJsonParser),
  }
  this.parserList = ['application/json']
  this.cache = lru(100)
}

BodyParser.prototype.clone = function() {
  const bodyParser = new BodyParser(this.bodyLimit)
  Object.assign(bodyParser.customParsers, this.customParsers)
  bodyParser.parserList = this.parserList.slice()
  return bodyParser
}

BodyParser.prototype.add = function(contentType, opts, parserFn) {
  if (typeof contentType !== 'string' || contentType === '') {
    throw new TypeError('The content type must be a string and cannot be empty')
  }
  if (typeof parserFn !== 'function') {
    throw new TypeError(`The parser argument must be a function. Got: ${parserFn}`)
  }

  if (this.hasParser(contentType)) {
    throw new Error(`Body parser for content type '${contentType}' already present.`)
  }

  if (opts.parseAs !== undefined && opts.parseAs !== 'string' && opts.parseAs !== 'buffer') {
    throw new Error(`The 'parseAs' option must be either 'string' or 'buffer'. Got '${opts.parseAs}'.`)
  }

  if (opts.parseAs === undefined && opts.bodyLimit !== undefined) {
    throw new Error(
      "Received the 'bodyLimit' option without the 'parseAs' option. " +
      "The 'bodyLimit' option has no effect without the 'parseAs' option."
    )
  }

  const parser = new Parser(
    opts.parseAs === 'string',
    opts.parseAs === 'buffer',
    opts.bodyLimit || this.bodyLimit,
    parserFn
  )

  if (contentType === '*') {
    this.parserList.push('')
    this.customParsers[''] = parser
  } else {
    if (contentType !== 'application/json') {
      this.parserList.unshift(contentType)
    }
    this.customParsers[contentType] = parser
  }
}

BodyParser.prototype.hasParser = function(contentType) {
  if (contentType === 'application/json') {
    return this.customParsers['application/json'].fn !== defaultJsonParser
  }
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

BodyParser.prototype.run = function(
  contentType = '',
  contentLength,
  request,
  response,
  runPreHandlerHooks
) {
  var parser = this.cache.get(contentType) || this.getParser(contentType)

  if (parser === undefined) {
    response.error(415, new Error('Unsupported Media Type: ' + contentType))
    return
  }

  if (parser.asString === true || parser.asBuffer === true) {
    var {parserOptions} = response.route
    var bodyLimit = parserOptions.limit === null ? parser.bodyLimit : parserOptions.limit

    if (contentLength > bodyLimit) {
      response.error(413, new Error('Request body is too large'))
      return
    }

    rawBody(request.req, response, parser, contentLength, bodyLimit, done)
  } else {
    var result = parser.fn(request.req, done)
    if (result && typeof result.then === 'function') {
      result.then(body => done(null, body), done)
    }
  }

  function done(error, body) {
    if (error) {
      response.error(error)
    } else {
      request.body = body
      runPreHandlerHooks(response)
    }
  }
}

function rawBody(req, response, parser, contentLength, bodyLimit, done) {
  var {asString} = parser
  var body = asString === true ? '' : []
  var receivedLength = 0

  req.on('data', onData)
  req.on('end', onEnd)
  req.on('error', onEnd)

  function onData(chunk) {
    receivedLength += chunk.length

    if (receivedLength > bodyLimit) {
      req.removeListener('data', onData)
      req.removeListener('end', onEnd)
      req.removeListener('error', onEnd)
      response.error(413, new Error('Request body is too large'))
      return
    }

    if (asString === true) {
      body += chunk.toString()
    } else {
      body.push(chunk)
    }
  }

  function onEnd(err) {
    req.removeListener('data', onData)
    req.removeListener('end', onEnd)
    req.removeListener('error', onEnd)

    if (err !== undefined) {
      response.error(400, err)
      return
    }

    if (contentLength !== -1 && receivedLength !== contentLength) {
      response.error(400, new Error('Request body size did not match Content-Length'))
      return
    }

    if (asString === false) {
      body = Buffer.concat(body)
    }

    var result = parser.fn(req, body, done)
    if (result && typeof result.then === 'function') {
      result.then(parsedBody => done(null, parsedBody), done)
    }
  }
}

function defaultJsonParser(req, body, done) {
  var json
  try {
    json = JSON.parse(body)
  } catch (err) {
    err.status = 400
    done(err, undefined)
    return
  }
  done(null, json)
}

function Parser(asString, asBuffer, bodyLimit, fn) {
  this.asString = asString
  this.asBuffer = asBuffer
  this.bodyLimit = bodyLimit
  this.fn = fn
}

module.exports = BodyParser
