'use strict'

const findMyWay = require('find-my-way')
const avvio = require('avvio')
const http = require('http')
const https = require('https')
const lightMyRequest = require('light-my-request')

const Reply = require('./lib/Reply')
const Request = require('./lib/Request')
const handleRequest = require('./lib/handleRequest')
const decorator = require('./lib/decorate')
const ContentTypeParser = require('./lib/ContentTypeParser')
const Hooks = require('./lib/Hooks')
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

function build(options) {
  options = options || {}
  if (typeof options !== 'object') {
    throw new TypeError('Options must be an object')
  }

  const router = findMyWay({
    defaultRoute,
    ignoreTrailingSlash: options.ignoreTrailingSlash,
    maxParamLength: options.maxParamLength,
  })

  const fastify = {
    _children: [],
    printRoutes: router.prettyPrint.bind(router),
  }

  const app = avvio(fastify, {
    autostart: false,
  })
  // Override to allow the plugin incapsulation
  app.override = override

  var listening = false
  // true when Fastify is ready to go
  var started = false
  app.on('start', () => {
    started = true
  })

  function throwIfAlreadyStarted(msg) {
    if (started) {
      throw new Error(msg)
    }
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
    get() {
      return this._routePrefix
    },
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

  var fourOhFour = findMyWay({defaultRoute: fourOhFourFallBack})
  fastify.setNotFoundHandler = setNotFoundHandler
  fastify._notFoundHandler = null
  fastify._404Context = null
  fastify.setNotFoundHandler(basic404) // Set the default 404 handler

  fastify.setErrorHandler = setErrorHandler

  return fastify

  function routeHandler(req, res, params, context) {
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

  function runOnResponseHooks() {
    this.removeListener('finish', runOnResponseHooks)
    this.removeListener('error', runOnResponseHooks)

    runHooks(
      this._onResponseHooks,
      onResponseIterator,
      this,
      onResponseCallback
    )
  }

  function onResponseIterator(fn, res, next) {
    return fn(res, next)
  }

  function onResponseCallback() {
    // noop
  }

  function listen(port, host, backlog, cb) {
    /* Deal with listen (port, cb) */
    if (typeof host === 'function') {
      cb = host
      host = undefined
    }
    host = host || '127.0.0.1'

    /* Deal with listen (port, host, cb) */
    if (typeof backlog === 'function') {
      cb = backlog
      backlog = undefined
    }

    if (cb === undefined) {
      return new Promise((resolve, reject) => {
        fastify.listen(port, host, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    fastify.ready((err) => {
      if (err) {
        cb(err)
        return
      }
      if (listening) {
        cb(new Error('Fastify is already listening'))
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

  function State(req, res, params, context) {
    this.req = req
    this.res = res
    this.params = params
    this.context = context
  }

  function hookIterator(fn, state, next) {
    if (state.res.finished === true) {
      return undefined
    }
    return fn(state.req, state.res, next)
  }

  function onRequestCallback(err, state) {
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

  function override(old, fn, opts) {
    const shouldSkipOverride = pluginUtils.registerPlugin.call(old, fn)
    if (shouldSkipOverride) {
      return old
    }

    const instance = Object.create(old)
    old._children.push(instance)
    instance._children = []
    instance._Reply = Reply.buildReply(instance._Reply)
    instance._Request = Request.buildRequest(instance._Request)
    instance._contentTypeParser =
      ContentTypeParser.buildContentTypeParser(instance._contentTypeParser)
    instance._hooks = Hooks.buildHooks(instance._hooks)
    instance._routePrefix = buildRoutePrefix(instance._routePrefix, opts.prefix)
    instance[pluginUtils.registeredPlugins] = Object.create(instance[pluginUtils.registeredPlugins])

    if (opts.prefix) {
      instance._notFoundHandler = null
      instance._404Context = null
    }

    return instance
  }

  function buildRoutePrefix(instancePrefix, pluginPrefix) {
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
  function _delete(url, opts, handler) {
    return _route(this, 'DELETE', url, opts, handler)
  }

  function _get(url, opts, handler) {
    return _route(this, 'GET', url, opts, handler)
  }

  function _head(url, opts, handler) {
    return _route(this, 'HEAD', url, opts, handler)
  }

  function _patch(url, opts, handler) {
    return _route(this, 'PATCH', url, opts, handler)
  }

  function _post(url, opts, handler) {
    return _route(this, 'POST', url, opts, handler)
  }

  function _put(url, opts, handler) {
    return _route(this, 'PUT', url, opts, handler)
  }

  function _options(url, opts, handler) {
    return _route(this, 'OPTIONS', url, opts, handler)
  }

  function _all(url, opts, handler) {
    return _route(this, supportedMethods, url, opts, handler)
  }

  function _route(_fastify, method, url, opts, handler) {
    if (!handler && typeof opts === 'function') {
      handler = opts
      opts = {}
    }

    opts = Object.assign({}, opts, {
      method,
      url,
      handler,
    })

    return _fastify.route(opts)
  }

  // Route management
  function route(opts) {
    throwIfAlreadyStarted('Cannot add route when fastify instance is already started!')

    const _fastify = this

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

    _fastify.after(function afterRouteAdded(notHandledErr, done) {
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
        _fastify,
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

  function Context(appInstance, serializers, handler, config, bodyLimit, storeApp) {
    this._jsonSerializers = serializers
    this.handler = handler
    this.config = config
    this._parserOptions = {
      limit: bodyLimit || null,
    }
    this.Reply = appInstance._Reply
    this.Request = appInstance._Request
    this.contentTypeParser = appInstance._contentTypeParser
    this.errorHandler = appInstance._errorHandler
    this.onRequest = null
    this.preHandler = null
    this.onSend = null
    this.onResponse = null
    this._fastify = storeApp ? appInstance : null
  }

  function inject(opts, cb) {
    if (started) {
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

  function _addHook(instance, name, fn) {
    instance._hooks.add(name, fn)
    instance._children.forEach(child => _addHook(child, name, fn))
  }

  function addContentTypeParser(contentType, opts, parser) {
    throwIfAlreadyStarted(
      'Cannot call "addContentTypeParser" when fastify instance is already started!'
    )

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

  function defaultRoute(req, res) {
    fourOhFour.lookup(req, res)
  }

  function basic404(req, reply) {
    reply.code(404).send(new Error('Not found'))
  }

  function fourOhFourFallBack(req, res) {
    const request = new Request(null, req, null, req.headers)
    const reply = new Reply(res, {onSend: []}, request)

    reply.code(404).send(new Error('Not found'))
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAlreadyStarted(
      'Cannot call "setNotFoundHandler" when fastify instance is already started!'
    )

    if (this._notFoundHandler !== null && this._notFoundHandler !== basic404) {
      throw new Error(
        `Not found handler already set for Fastify instance with prefix: '${this._routePrefix || '/'}'`
      )
    }

    if (handler === undefined) {
      handler = opts
      opts = {}
    }

    this._notFoundHandler = handler

    const serializers = buildSerializers(opts.responseSchema)

    this.after((notHandledErr, done) => {
      _setNotFoundHandler.call(this, opts, handler, serializers)
      done(notHandledErr)
    })
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

  function setErrorHandler(func) {
    throwIfAlreadyStarted('Cannot call "setErrorHandler" when fastify instance is already started!')

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

module.exports = build
