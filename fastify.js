'use strict'

const FindMyWay = require('find-my-way')
const avvio = require('avvio')
const http = require('http')
const https = require('https')
const lightMyRequest = require('light-my-request')

const Reply = require('./lib/Reply')
const Request = require('./lib/Request')
const supportedMethods = ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS']
const handleRequest = require('./lib/handleRequest')
const decorator = require('./lib/decorate')
const ContentTypeParser = require('./lib/ContentTypeParser')
const Hooks = require('./lib/Hooks')
const pluginUtils = require('./lib/pluginUtils')
const runHooks = require('./lib/hookRunner').hookRunner

const {buildSerializers} = require('./lib/Serializer')

const DEFAULT_BODY_LIMIT = 1024 * 1024 // 1 MiB
const childrenKey = Symbol('fastify.children')

function validateBodyLimitOption (bodyLimit) {
  if (bodyLimit === undefined) return
  if (!Number.isInteger(bodyLimit) || bodyLimit <= 0) {
    throw new TypeError(`'bodyLimit' option must be an integer > 0. Got '${bodyLimit}'`)
  }
}

function build (options) {
  options = options || {}
  if (typeof options !== 'object') {
    throw new TypeError('Options must be an object')
  }

  const fastify = {
    [childrenKey]: []
  }
  const router = FindMyWay({
    defaultRoute: defaultRoute,
    ignoreTrailingSlash: options.ignoreTrailingSlash,
    maxParamLength: options.maxParamLength
  })

  fastify.printRoutes = router.prettyPrint.bind(router)

  const app = avvio(fastify, {
    autostart: false
  })
  // Override to allow the plugin incapsulation
  app.override = override

  var listening = false
  // true when Fastify is ready to go
  var started = false
  app.on('start', () => {
    started = true
  })

  function throwIfAlreadyStarted (msg) {
    if (started) throw new Error(msg)
  }

  var server
  const httpHandler = router.lookup.bind(router)
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

  fastify.onClose((instance, done) => {
    if (listening) {
      instance.server.close(done)
    } else {
      done(null)
    }
  })

  // body limit option
  validateBodyLimitOption(options.bodyLimit)
  fastify._bodyLimit = options.bodyLimit || DEFAULT_BODY_LIMIT

  // shorthand methods
  fastify.delete = _delete
  fastify.get = _get
  fastify.head = _head
  fastify.patch = _patch
  fastify.post = _post
  fastify.put = _put
  fastify.options = _options
  fastify.all = _all
  // extended route
  fastify.route = route
  fastify._routePrefix = ''

  Object.defineProperty(fastify, 'basePath', {
    get: function () {
      return this._routePrefix
    }
  })

  // hooks
  fastify.addHook = addHook
  fastify._hooks = new Hooks()

  const onRouteHooks = []

  // custom parsers
  fastify.addContentTypeParser = addContentTypeParser
  fastify.hasContentTypeParser = hasContentTypeParser
  fastify._contentTypeParser = new ContentTypeParser(fastify._bodyLimit)

  // plugin
  fastify.register = fastify.use
  fastify.listen = listen
  fastify.server = server
  fastify[pluginUtils.registeredPlugins] = []

  // extend server methods
  fastify.decorate = decorator.add
  fastify.hasDecorator = decorator.exist
  fastify.decorateReply = decorator.decorateReply
  fastify.decorateRequest = decorator.decorateRequest

  fastify._Reply = Reply.buildReply(Reply)
  fastify._Request = Request.buildRequest(Request)

  // fake http injection
  fastify.inject = inject

  var fourOhFour = FindMyWay({ defaultRoute: fourOhFourFallBack })
  fastify.setNotFoundHandler = setNotFoundHandler
  fastify._notFoundHandler = null
  fastify._404Context = null
  fastify.setNotFoundHandler() // Set the default 404 handler

  fastify.setErrorHandler = setErrorHandler

  return fastify

  function routeHandler (req, res, params, context) {
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

  function runOnResponseHooks () {
    this.removeListener('finish', runOnResponseHooks)
    this.removeListener('error', runOnResponseHooks)

    runHooks(
      this._onResponseHooks,
      onResponseIterator,
      this,
      onResponseCallback
    )
  }

  function onResponseIterator (fn, res, next) {
    return fn(res, next)
  }

  function onResponseCallback () {
    // noop
  }

  function listen (port, address, backlog, cb) {
    /* Deal with listen (port, cb) */
    if (typeof address === 'function') {
      cb = address
      address = undefined
    }
    address = address || '127.0.0.1'

    /* Deal with listen (port, address, cb) */
    if (typeof backlog === 'function') {
      cb = backlog
      backlog = undefined
    }

    if (cb === undefined) {
      return new Promise((resolve, reject) => {
        fastify.listen(port, address, err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    fastify.ready(function (err) {
      if (err) return cb(err)
      if (listening) {
        return cb(new Error('Fastify is already listening'))
      }

      server.on('error', wrap)
      if (backlog) {
        server.listen(port, address, backlog, wrap)
      } else {
        server.listen(port, address, wrap)
      }

      listening = true
    })

    function wrap (err) {
      if (!err) {
        let address = server.address()
        if (typeof address === 'object') {
          if (address.address.indexOf(':') === -1) {
            address = address.address + ':' + address.port
          } else {
            address = '[' + address.address + ']:' + address.port
          }
        }
        address = 'http' + (options.https ? 's' : '') + '://' + address
      }

      server.removeListener('error', wrap)
      cb(err)
    }
  }

  function State (req, res, params, context) {
    this.req = req
    this.res = res
    this.params = params
    this.context = context
  }

  function hookIterator (fn, state, next) {
    if (state.res.finished === true) return undefined
    return fn(state.req, state.res, next)
  }

  function onRequestCallback (err, state) {
    if (state.res.finished === true) {
      return
    }

    if (err) {
      const req = state.req
      const request = new state.context.Request(state.params, req, null, req.headers)
      const reply = new state.context.Reply(state.res, state.context, request)
      reply.send(err)
      return
    }

    handleRequest(state.req, state.res, state.params, state.context)
  }

  function override (old, fn, opts) {
    const shouldSkipOverride = pluginUtils.registerPlugin.call(old, fn)
    if (shouldSkipOverride) {
      return old
    }

    const instance = Object.create(old)
    old[childrenKey].push(instance)
    instance[childrenKey] = []
    instance._Reply = Reply.buildReply(instance._Reply)
    instance._Request = Request.buildRequest(instance._Request)
    instance._contentTypeParser = ContentTypeParser.buildContentTypeParser(instance._contentTypeParser)
    instance._hooks = Hooks.buildHooks(instance._hooks)
    instance._routePrefix = buildRoutePrefix(instance._routePrefix, opts.prefix)
    instance[pluginUtils.registeredPlugins] = Object.create(instance[pluginUtils.registeredPlugins])

    if (opts.prefix) {
      instance._notFoundHandler = null
      instance._404Context = null
    }

    return instance
  }

  function buildRoutePrefix (instancePrefix, pluginPrefix) {
    if (!pluginPrefix) {
      return instancePrefix
    }

    // Ensure that there is a '/' between the prefixes
    if (instancePrefix.endsWith('/')) {
      if (pluginPrefix[0] === '/') {
        // Remove the extra '/' to avoid: '/first//second'
        pluginPrefix = pluginPrefix.slice(1)
      }
    } else if (pluginPrefix[0] !== '/') {
      pluginPrefix = '/' + pluginPrefix
    }

    return instancePrefix + pluginPrefix
  }

  // Shorthand methods
  function _delete (url, opts, handler) {
    return _route(this, 'DELETE', url, opts, handler)
  }

  function _get (url, opts, handler) {
    return _route(this, 'GET', url, opts, handler)
  }

  function _head (url, opts, handler) {
    return _route(this, 'HEAD', url, opts, handler)
  }

  function _patch (url, opts, handler) {
    return _route(this, 'PATCH', url, opts, handler)
  }

  function _post (url, opts, handler) {
    return _route(this, 'POST', url, opts, handler)
  }

  function _put (url, opts, handler) {
    return _route(this, 'PUT', url, opts, handler)
  }

  function _options (url, opts, handler) {
    return _route(this, 'OPTIONS', url, opts, handler)
  }

  function _all (url, opts, handler) {
    return _route(this, supportedMethods, url, opts, handler)
  }

  function _route (_fastify, method, url, options, handler) {
    if (!handler && typeof options === 'function') {
      handler = options
      options = {}
    }

    options = Object.assign({}, options, {
      method,
      url,
      handler
    })

    return _fastify.route(options)
  }

  // Route management
  function route (opts) {
    throwIfAlreadyStarted('Cannot add route when fastify instance is already started!')

    const _fastify = this

    if (Array.isArray(opts.method)) {
      for (var i = 0; i < opts.method.length; i++) {
        if (supportedMethods.indexOf(opts.method[i]) === -1) {
          throw new Error(`${opts.method[i]} method is not supported!`)
        }
      }
    } else {
      if (supportedMethods.indexOf(opts.method) === -1) {
        throw new Error(`${opts.method} method is not supported!`)
      }
    }

    if (!opts.handler) {
      throw new Error(`Missing handler function for ${opts.method}:${opts.url} route.`)
    }

    validateBodyLimitOption(opts.bodyLimit)

    _fastify.after(function afterRouteAdded (notHandledErr, done) {
      const prefix = _fastify._routePrefix
      var path = opts.url || opts.path
      if (path === '/' && prefix.length > 0) {
        // Ensure that '/prefix' + '/' gets registered as '/prefix'
        path = ''
      } else if (path[0] === '/' && prefix.endsWith('/')) {
        // Ensure that '/prefix/' + '/route' gets registered as '/prefix/route'
        path = path.slice(1)
      }
      const url = prefix + path

      opts.url = url
      opts.path = url
      opts.prefix = prefix

      // run 'onRoute' hooks
      for (var h of onRouteHooks) {
        h.call(_fastify, opts)
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
        serializers,
        opts.handler.bind(_fastify),
        _fastify._Reply,
        _fastify._Request,
        _fastify._contentTypeParser,
        config,
        _fastify._errorHandler,
        opts.bodyLimit,
        _fastify
      )

      if (opts.beforeHandler) {
        if (Array.isArray(opts.beforeHandler)) {
          opts.beforeHandler.forEach((h, i) => {
            opts.beforeHandler[i] = h.bind(_fastify)
          })
        } else {
          opts.beforeHandler = opts.beforeHandler.bind(_fastify)
        }
      }

      try {
        router.on(opts.method, url, routeHandler, context)
      } catch (err) {
        done(err)
        return
      }

      // It can happen that a user register a plugin with some hooks *after* the route registration.
      // To be sure to load also that hoooks, we must listen for the avvio's 'preReady' event and
      // update the context object accordingly.
      app.once('preReady', () => {
        const onRequest = _fastify._hooks.onRequest
        const onResponse = _fastify._hooks.onResponse
        const onSend = _fastify._hooks.onSend
        const preHandler = _fastify._hooks.preHandler.concat(opts.beforeHandler || [])

        context.onRequest = onRequest.length ? onRequest : null
        context.preHandler = preHandler.length ? preHandler : null
        context.onSend = onSend.length ? onSend : null
        context.onResponse = onResponse.length ? onResponse : null
      })

      done(notHandledErr)
    })

    // chainable api
    return _fastify
  }

  function Context (serializers, handler, Reply, Request, contentTypeParser, config, errorHandler, bodyLimit, fastify) {
    this._jsonSerializers = serializers
    this.handler = handler
    this.Reply = Reply
    this.Request = Request
    this.contentTypeParser = contentTypeParser
    this.onRequest = null
    this.onSend = null
    this.preHandler = null
    this.onResponse = null
    this.config = config
    this.errorHandler = errorHandler
    this._parserOptions = {
      limit: bodyLimit || null
    }
    this._fastify = fastify
  }

  function inject (opts, cb) {
    if (started) {
      return lightMyRequest(httpHandler, opts, cb)
    }

    if (cb) {
      this.ready(err => {
        if (err) throw err
        return lightMyRequest(httpHandler, opts, cb)
      })
    } else {
      return new Promise((resolve, reject) => {
        this.ready(err => {
          if (err) return reject(err)
          resolve()
        })
      }).then(() => lightMyRequest(httpHandler, opts))
    }
  }

  function addHook (name, fn) {
    throwIfAlreadyStarted('Cannot call "addHook" when fastify instance is already started!')

    if (name === 'onClose') {
      this._hooks.validate(name, fn)
      this.onClose(fn)
    } else if (name === 'onRoute') {
      this._hooks.validate(name, fn)
      onRouteHooks.push(fn)
    } else {
      this.after((err, done) => {
        _addHook(this, name, fn)
        done(err)
      })
    }
    return this
  }

  function _addHook (instance, name, fn) {
    instance._hooks.add(name, fn.bind(instance))
    instance[childrenKey].forEach(child => _addHook(child, name, fn))
  }

  function addContentTypeParser (contentType, opts, parser) {
    throwIfAlreadyStarted('Cannot call "addContentTypeParser" when fastify instance is already started!')

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

  function hasContentTypeParser (contentType, fn) {
    return this._contentTypeParser.hasParser(contentType)
  }

  function defaultRoute (req, res) {
    fourOhFour.lookup(req, res)
  }

  function basic404 (req, reply) {
    reply.code(404).send(new Error('Not found'))
  }

  function fourOhFourFallBack (req, res) {
    const request = new Request(null, req, null, req.headers)
    const reply = new Reply(res, { onSend: [] }, request)

    reply.code(404).send(new Error('Not found'))
  }

  function setNotFoundHandler (opts, handler) {
    throwIfAlreadyStarted('Cannot call "setNotFoundHandler" when fastify instance is already started!')

    if (this._notFoundHandler !== null && this._notFoundHandler !== basic404) {
      throw new Error(`Not found handler already set for Fastify instance with prefix: '${this._routePrefix || '/'}'`)
    }

    if (typeof opts === 'function') {
      handler = opts
      opts = undefined
    }
    opts = opts || {}
    handler = handler ? handler.bind(this) : basic404

    this._notFoundHandler = handler

    const serializers = buildSerializers(opts.responseSchema)

    this.after((notHandledErr, done) => {
      _setNotFoundHandler.call(this, opts, handler, serializers)
      done(notHandledErr)
    })
  }

  function _setNotFoundHandler (opts, handler, serializers) {
    const context = new Context(
      serializers,
      handler,
      this._Reply,
      this._Request,
      this._contentTypeParser,
      opts.config || {},
      this._errorHandler,
      this._bodyLimit,
      null
    )

    app.once('preReady', () => {
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

    fourOhFour.all(prefix + (prefix.endsWith('/') ? '*' : '/*'), routeHandler, context)
    fourOhFour.all(prefix || '/', routeHandler, context)
  }

  function setErrorHandler (func) {
    throwIfAlreadyStarted('Cannot call "setErrorHandler" when fastify instance is already started!')

    this._errorHandler = func
    return this
  }
}

function http2 () {
  try {
    return require('http2')
  } catch (err) {
    console.error('http2 is available only from node >= 8.8.1')
  }
}

module.exports = build
