'use strict'

const avvio = require('avvio')
const findMyWay = require('find-my-way')
const http = require('http')
const https = require('https')
const lightMyRequest = require('light-my-request')
const querystring = require('querystring')

const ContentTypeParser = require('./lib/ContentTypeParser')
const Hooks = require('./lib/Hooks')
const Reply = require('./lib/Reply')
const Request = require('./lib/Request')

const decorator = require('./lib/decorate')
const handleRequest = require('./lib/handleRequest')
const parseQuery = require('./lib/parseQuery')
const pluginUtils = require('./lib/pluginUtils')
const runHooks = require('./lib/hookRunner').hookRunner

const {buildSerializers} = require('./lib/Serializer')

const supportedMethods = ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS']

const DEFAULT_BODY_LIMIT = 1024 * 1024 // 1 MiB

function validateBodyLimitOption(bodyLimit) {
  if (bodyLimit === undefined) {
    return
  }
  if (!Number.isInteger(bodyLimit) || bodyLimit <= 0) {
    throw new TypeError(`'bodyLimit' option must be an integer > 0. Got '${bodyLimit}'`)
  }
}

function medley(options) {
  options = options || {}
  if (typeof options !== 'object') {
    throw new TypeError('Options must be an object')
  }

  validateBodyLimitOption(options.bodyLimit)

  if (options.queryParser !== undefined && typeof options.queryParser !== 'function') {
    throw new TypeError(`'queryParser' option must be an function. Got '${options.queryParser}'`)
  }

  const notFoundRouter = findMyWay({defaultRoute: notFoundFallbackRoute})
  const router = findMyWay({
    defaultRoute: notFoundRouter.lookup.bind(notFoundRouter),
    ignoreTrailingSlash: options.ignoreTrailingSlash,
    maxParamLength: options.maxParamLength,
  })
  const httpHandler = router.lookup.bind(router)

  var server
  if (options.https) {
    if (options.http2) {
      server = http2().createSecureServer(options.https, httpHandler)
    } else {
      server = https.createServer(options.https, httpHandler)
    }
  } else if (options.http2) {
    server = http2().createServer(httpHandler)
  } else {
    server = http.createServer(httpHandler)
  }

  const _bodyLimit = options.bodyLimit || DEFAULT_BODY_LIMIT

  const app = {
    _bodyLimit,
    _queryParser: options.queryParser || querystring.parse,
    printRoutes: router.prettyPrint.bind(router),
    server,
    listen,

    // Decorator methods
    decorate: decorator.decorateApp,
    decorateReply: decorator.decorateReply,
    decorateRequest: decorator.decorateRequest,

    // Routing
    route,
    delete: _createShorthandRouteMethod('DELETE'),
    get: _createShorthandRouteMethod('GET'),
    head: _createShorthandRouteMethod('HEAD'),
    patch: _createShorthandRouteMethod('PATCH'),
    post: _createShorthandRouteMethod('POST'),
    put: _createShorthandRouteMethod('PUT'),
    options: _createShorthandRouteMethod('OPTIONS'),
    all: _createShorthandRouteMethod(supportedMethods),

    get basePath() {
      return this._routePrefix
    },
    _routePrefix: '',

    setNotFoundHandler,
    _notFoundHandler: null,
    _404Context: null,

    setErrorHandler,

    // Hooks
    addHook,
    _hooks: new Hooks(),

    // Body parsing
    addContentTypeParser,
    hasContentTypeParser,
    _contentTypeParser: new ContentTypeParser(_bodyLimit),

    inject, // Fake HTTP injection

    _Request: Request.buildRequest(Request),
    _Reply: Reply.buildReply(Reply),
    [pluginUtils.registeredPlugins]: [], // For storing plugins
    _children: [], // For storing child app instances
  }

  const appLoader = avvio(app, {
    autostart: false,
    expose: {use: 'register'},
  })
  appLoader.override = override // Override to allow plugin incapsulation

  var ready = false // true when plugins and sub apps have loaded
  var listening = false // true when server is listening

  appLoader.on('start', () => {
    ready = true
  })

  function throwIfAlreadyStarted(msg) {
    if (ready) {
      throw new Error(msg)
    }
  }

  app.onClose((_app, done) => {
    if (listening) {
      _app.server.close(done)
    } else {
      done(null)
    }
  })

  const onRouteHooks = []

  app.setNotFoundHandler(basic404) // Set the default 404 handler

  return app

  function listen(port, host, backlog, cb) {
    // Handle listen (port, cb)
    if (typeof host === 'function') {
      cb = host
      host = undefined
    }
    host = host || '127.0.0.1'

    // Handle listen (port, host, cb)
    if (typeof backlog === 'function') {
      cb = backlog
      backlog = undefined
    }

    if (cb === undefined) {
      return new Promise((resolve, reject) => {
        this.listen(port, host, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    this.ready((err) => {
      if (err) {
        cb(err)
        return
      }
      if (listening) {
        cb(new Error('app is already listening'))
        return
      }

      function handleListening(err) {
        server.removeListener('error', handleListening)
        cb(err)
      }

      server.on('error', handleListening)
      if (backlog) {
        server.listen(port, host, backlog, handleListening)
      } else {
        server.listen(port, host, handleListening)
      }

      listening = true
    })

    return undefined
  }

  function routeHandler(req, res, params, context) {
    res._onResponseHooks = undefined
    if (context.onResponse !== null) {
      res._onResponseHooks = context.onResponse
      res.on('finish', runOnResponseHooks)
      res.on('error', runOnResponseHooks)
    }

    if (context.onRequest === null) {
      onRequestCallback(null, new State(req, res, params, context))
    } else {
      runHooks(
        context.onRequest,
        hookIterator,
        new State(req, res, params, context),
        onRequestCallback
      )
    }
  }

  function State(req, res, params, context) {
    this.req = req
    this.res = res
    this.params = params
    this.context = context
  }

  function hookIterator(fn, state, next) {
    return state.res.finished ? undefined : fn(state.req, state.res, next)
  }

  function onRequestCallback(err, state) {
    if (state.res.finished) {
      return
    }

    var {context, req} = state
    var request = new context.Request(
      req,
      req.headers,
      state.params,
      parseQuery(req.url, context.queryParser)
    )
    var reply = new context.Reply(state.res, request, context)

    if (err) {
      reply.send(err)
    } else {
      handleRequest(reply, context)
    }
  }

  function runOnResponseHooks() {
    this.removeListener('finish', runOnResponseHooks)
    this.removeListener('error', runOnResponseHooks)

    const onResponseHooks = this._onResponseHooks
    for (var i = 0; i < onResponseHooks.length; i++) {
      onResponseHooks[i](this)
    }
  }

  function override(parentApp, fn, opts) {
    const shouldSkipOverride = pluginUtils.registerPlugin.call(parentApp, fn)
    if (shouldSkipOverride) {
      return parentApp
    }

    const subApp = Object.create(parentApp)
    parentApp._children.push(subApp)
    subApp._children = []
    subApp._Reply = Reply.buildReply(subApp._Reply)
    subApp._Request = Request.buildRequest(subApp._Request)
    subApp._contentTypeParser =
      ContentTypeParser.buildContentTypeParser(subApp._contentTypeParser)
    subApp._hooks = Hooks.buildHooks(subApp._hooks)
    subApp._routePrefix = buildRoutePrefix(subApp._routePrefix, opts.prefix)
    subApp[pluginUtils.registeredPlugins] = Object.create(subApp[pluginUtils.registeredPlugins])

    if (opts.prefix) {
      subApp._notFoundHandler = null
      subApp._404Context = null
    }

    return subApp
  }

  function buildRoutePrefix(basePrefix, pluginPrefix) {
    if (!pluginPrefix) {
      return basePrefix
    }

    // Ensure that there is a '/' between the prefixes
    if (basePrefix.endsWith('/')) {
      if (pluginPrefix[0] === '/') {
        // Remove the extra '/' to avoid: '/first//second'
        pluginPrefix = pluginPrefix.slice(1)
      }
    } else if (pluginPrefix[0] !== '/') {
      pluginPrefix = '/' + pluginPrefix
    }

    return basePrefix + pluginPrefix
  }

  // Routing methods
  function _createShorthandRouteMethod(method) {
    return function(url, opts, handler) {
      return _route(this, method, url, opts, handler)
    }
  }

  function _route(appInstance, method, url, opts, handler) {
    if (!handler && typeof opts === 'function') {
      handler = opts
      opts = {}
    }

    opts = Object.assign({}, opts, {
      method,
      url,
      handler,
    })

    return appInstance.route(opts)
  }

  function route(opts) {
    throwIfAlreadyStarted('Cannot add route when app is already loaded!')

    if (Array.isArray(opts.method)) {
      for (var i = 0; i < opts.method.length; i++) {
        if (supportedMethods.indexOf(opts.method[i]) === -1) {
          throw new Error(`${opts.method[i]} method is not supported!`)
        }
      }
    } else if (supportedMethods.indexOf(opts.method) === -1) {
      throw new Error(`${opts.method} method is not supported!`)
    }

    if (typeof opts.handler !== 'function') {
      throw new Error(
        `Got '${opts.handler}' as the handler for the ${opts.method}:${opts.url} route. Expected a function.`
      )
    }

    validateBodyLimitOption(opts.bodyLimit)

    this.after((err, done) => {
      if (err) {
        done(err)
        return
      }

      const prefix = this._routePrefix
      var url = opts.url || opts.path
      if (url === '/' && prefix.length > 0) {
        // Ensure that '/prefix' + '/' gets registered as '/prefix'
        url = ''
      } else if (url[0] === '/' && prefix.endsWith('/')) {
        // Ensure that '/prefix/' + '/route' gets registered as '/prefix/route'
        url = url.slice(1)
      }
      url = prefix + url

      opts.url = opts.path = url
      opts.prefix = prefix

      // Run 'onRoute' hooks
      for (const hook of onRouteHooks) {
        hook(opts)
      }

      const config = opts.config || {}
      config.url = url

      var serializers
      try {
        serializers = buildSerializers(opts.responseSchema)
      } catch (err) {
        done(err)
        return
      }

      const context = new Context(
        this,
        serializers,
        opts.handler,
        config,
        opts.bodyLimit,
        true
      )

      try {
        router.on(opts.method, url, routeHandler, context)
      } catch (err) {
        done(err)
        return
      }

      // It can happen that a user register a plugin with some hooks *after* the route registration.
      // To be sure to load also that hoooks, we must listen for the avvio's 'preReady' event and
      // update the context object accordingly.
      appLoader.once('preReady', () => {
        const onRequest = this._hooks.onRequest
        const onResponse = this._hooks.onResponse
        const onSend = this._hooks.onSend
        const preHandler = this._hooks.preHandler.concat(opts.beforeHandler || [])

        context.onRequest = onRequest.length ? onRequest : null
        context.preHandler = preHandler.length ? preHandler : null
        context.onSend = onSend.length ? onSend : null
        context.onResponse = onResponse.length ? onResponse : null
      })

      done()
    })

    return this // Chainable api
  }

  function Context(appInstance, jsonSerializers, handler, config, bodyLimit, storeApp) {
    this.jsonSerializers = jsonSerializers
    this.handler = handler
    this.config = config
    this.parserOptions = {
      limit: bodyLimit || null,
    }
    this.Reply = appInstance._Reply
    this.Request = appInstance._Request
    this.contentTypeParser = appInstance._contentTypeParser
    this.errorHandler = appInstance._errorHandler
    this.queryParser = appInstance._queryParser
    this.onRequest = null
    this.preHandler = null
    this.onSend = null
    this.onResponse = null
    this.appInstance = storeApp ? appInstance : null
  }

  function inject(opts, cb) {
    if (ready) {
      return lightMyRequest(httpHandler, opts, cb)
    }

    if (!cb) {
      return new Promise((resolve, reject) => {
        this.ready((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }).then(() => lightMyRequest(httpHandler, opts))
    }

    this.ready((err) => {
      if (err) {
        throw err
      }
      lightMyRequest(httpHandler, opts, cb)
    })

    return undefined
  }

  function addHook(name, fn) {
    throwIfAlreadyStarted('Cannot call "addHook" when app is already loaded!')

    if (name === 'onClose') {
      this._hooks.validate(name, fn)
      this.onClose(fn)
    } else if (name === 'onRoute') {
      this._hooks.validate(name, fn)
      onRouteHooks.push(fn)
    } else {
      this.after((err, done) => {
        if (err) {
          done(err)
          return
        }
        _addHook(this, name, fn)
        done()
      })
    }
    return this
  }

  function _addHook(appInstance, name, fn) {
    appInstance._hooks.add(name, fn)
    appInstance._children.forEach(child => _addHook(child, name, fn))
  }

  function addContentTypeParser(contentType, opts, parser) {
    throwIfAlreadyStarted('Cannot call "addContentTypeParser" when app is already loaded!')

    if (typeof opts === 'function') {
      parser = opts
      opts = {}
    }

    if (!opts) {
      opts = {}
    }

    if (!opts.bodyLimit) {
      opts.bodyLimit = this._bodyLimit
    }

    this._contentTypeParser.add(contentType, opts, parser)
    return this
  }

  function hasContentTypeParser(contentType) {
    return this._contentTypeParser.hasParser(contentType)
  }

  function basic404(request, reply) {
    reply.code(404).send(new Error('Not found'))
  }

  function notFoundFallbackRoute(req, res) {
    res.statusCode = 501 // Not Implemented
    res.end('Unsupported request method: ' + req.method)
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAlreadyStarted('Cannot call "setNotFoundHandler" when app is already loaded!')

    if (this._notFoundHandler !== null && this._notFoundHandler !== basic404) {
      throw new Error(
        `Not found handler already set for app instance with prefix: '${this._routePrefix || '/'}'`
      )
    }

    if (handler === undefined) {
      handler = opts
      opts = {}
    }

    this._notFoundHandler = handler

    const serializers = buildSerializers(opts.responseSchema)

    this.after((err, done) => {
      if (err) {
        done(err)
        return
      }
      _setNotFoundHandler.call(this, opts, handler, serializers)
      done()
    })

    return this
  }

  function _setNotFoundHandler(opts, handler, serializers) {
    const context = new Context(
      this,
      serializers,
      handler,
      opts.config || {},
      opts.bodyLimit,
      false
    )

    appLoader.once('preReady', () => {
      const context404 = this._404Context

      const onRequest = this._hooks.onRequest
      const preHandler = this._hooks.preHandler
      const onSend = this._hooks.onSend
      const onResponse = this._hooks.onResponse

      context404.onRequest = onRequest.length ? onRequest : null
      context404.preHandler = preHandler.length ? preHandler : null
      context404.onSend = onSend.length ? onSend : null
      context404.onResponse = onResponse.length ? onResponse : null
    })

    if (this._404Context !== null) {
      Object.assign(this._404Context, context) // Replace the default 404 handler
      return
    }

    this._404Context = context

    const prefix = this._routePrefix

    notFoundRouter.on(
      supportedMethods,
      prefix + (prefix.endsWith('/') ? '*' : '/*'),
      routeHandler,
      context
    )
    notFoundRouter.on(
      supportedMethods,
      prefix || '/',
      routeHandler,
      context
    )
  }

  function setErrorHandler(func) {
    throwIfAlreadyStarted('Cannot call "setErrorHandler" when app is already loaded!')

    this._errorHandler = func
    return this
  }
}

function http2() {
  try {
    return require('http2')
  } catch (err) {
    console.error('http2 is available only from node >= 8.8.1') // eslint-disable-line no-console
    return undefined
  }
}

module.exports = medley
