'use strict'

const avvio = require('avvio')
const findMyWay = require('find-my-way')
const http = require('http')
const https = require('https')
const lightMyRequest = require('light-my-request')

const BodyParser = require('./lib/BodyParser')
const Context = require('./lib/Context')
const Hooks = require('./lib/Hooks')
const Reply = require('./lib/Reply')
const Request = require('./lib/Request')

const pluginUtils = require('./lib/pluginUtils')

const {buildSerializers} = require('./lib/Serializer')
const {
  routeHandler,
  methodHandlers,
  defaultNotFoundHandler,
  notFoundFallbackHandler,
} = require('./lib/RequestHandlers')

const supportedMethods = Object.keys(methodHandlers)

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

  const notFoundRouter = findMyWay({defaultRoute: notFoundFallbackHandler})
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

  const app = {
    printRoutes: router.prettyPrint.bind(router),
    server,
    listen,

    // Decorator methods
    decorate: decorateApp,
    decorateRequest,
    decorateReply,

    // Routing
    route,
    delete: createShorthandRouteMethod('DELETE'),
    get: createShorthandRouteMethod('GET'),
    head: createShorthandRouteMethod('HEAD'),
    patch: createShorthandRouteMethod('PATCH'),
    post: createShorthandRouteMethod('POST'),
    put: createShorthandRouteMethod('PUT'),
    options: createShorthandRouteMethod('OPTIONS'),
    all: createShorthandRouteMethod(supportedMethods),

    get basePath() {
      return this._routePrefix
    },
    _routePrefix: '',

    setNotFoundHandler,
    _canSetNotFoundHandler: true,
    _notFoundLevelApp: null,
    _notFoundContexts: null,

    setErrorHandler,
    _errorHandler: null,

    // Hooks
    addHook,
    _hooks: new Hooks(),

    // Body parsing
    addBodyParser,
    hasBodyParser,
    _bodyParser: new BodyParser(options.bodyLimit || DEFAULT_BODY_LIMIT),

    inject, // Fake HTTP injection

    _Request: Request.buildRequest(),
    _Reply: Reply.buildReply(),
    _subApps: [],
    [pluginUtils.registeredPlugins]: [], // For storing plugins
  }

  const appLoader = avvio(app, {
    autostart: false,
    expose: {use: 'register'},
  })
  appLoader.override = override // Override to allow plugin encapsulation

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

  app._notFoundLevelApp = app
  app.setNotFoundHandler(defaultNotFoundHandler)
  app._canSetNotFoundHandler = true // Allowed to override the default 404 handler

  return app

  function decorateApp(name, fn) {
    if (name in this) {
      throw new Error(`The decorator '${name}' has been already added!`)
    }

    this[name] = fn
    return this
  }

  function decorateRequest(name, fn) {
    if (name in this._Request.prototype) {
      throw new Error(`The decorator '${name}' has been already added to Request!`)
    }

    this._Request.prototype[name] = fn
    return this
  }

  function decorateReply(name, fn) {
    if (name in this._Reply.prototype) {
      throw new Error(`The decorator '${name}' has been already added to Reply!`)
    }

    this._Reply.prototype[name] = fn
    return this
  }

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

  function override(parentApp, fn, opts) {
    const shouldSkipOverride = pluginUtils.registerPlugin.call(parentApp, fn)
    if (shouldSkipOverride) {
      return parentApp
    }

    const subApp = Object.create(parentApp)
    parentApp._subApps.push(subApp)
    subApp._subApps = []
    subApp._Request = Request.buildRequest(subApp._Request)
    subApp._Reply = Reply.buildReply(subApp._Reply)
    subApp._bodyParser = subApp._bodyParser.clone()
    subApp._hooks = Hooks.buildHooks(subApp._hooks)
    subApp._routePrefix = buildRoutePrefix(parentApp._routePrefix, opts.prefix)
    subApp[pluginUtils.registeredPlugins] = Object.create(subApp[pluginUtils.registeredPlugins])

    if (opts.prefix) {
      subApp._canSetNotFoundHandler = true
      subApp._notFoundLevelApp = subApp
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
  function createShorthandRouteMethod(method) {
    return function(url, opts, handler) {
      if (handler === undefined) {
        handler = opts
        opts = {}
      }

      opts = Object.assign({}, opts, {
        method,
        url,
        handler,
      })

      return this.route(opts)
    }
  }

  function route(opts) {
    throwIfAlreadyStarted('Cannot add route when app is already loaded!')

    const methods = Array.isArray(opts.method) ? opts.method : [opts.method]
    const methodGroups = new Map()

    // Group up methods with the same methodHandler
    for (var i = 0; i < methods.length; i++) {
      const method = methods[i]
      const methodHandler = methodHandlers[method]

      if (methodHandler === undefined) {
        throw new Error(`${method} method is not supported!`)
      }

      if (methodGroups.has(methodHandler)) {
        methodGroups.get(methodHandler).push(method)
      } else {
        methodGroups.set(methodHandler, [method])
      }
    }

    if (typeof opts.handler !== 'function') {
      throw new Error(
        `Got '${opts.handler}' as the handler for the ${opts.method}:${opts.url} route. Expected a function.`
      )
    }

    validateBodyLimitOption(opts.bodyLimit)

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

    for (const [methodHandler, method] of methodGroups) {
      _route.call(this, method, methodHandler, url, opts)
    }

    return this // Chainable
  }

  function _route(method, methodHandler, url, opts) {
    this.after((err, done) => {
      if (err) {
        done(err)
        return
      }

      // Run 'onRoute' hooks
      for (const hook of onRouteHooks) {
        hook(opts)
      }

      var serializers
      try {
        serializers = buildSerializers(opts.responseSchema)
      } catch (err) {
        done(err)
        return
      }

      const context = Context.create(
        this,
        serializers,
        methodHandler,
        opts.handler,
        opts.config || {},
        opts.bodyLimit,
      )

      try {
        router.on(method, url, routeHandler, context)
      } catch (err) {
        done(err)
        return
      }

      // It can happen that a user register a plugin with some hooks *after* the route registration.
      // To be sure to load also that hoooks, we must listen for the avvio's 'preReady' event and
      // update the context object accordingly.
      appLoader.once('preReady', () => {
        const onRequest = this._hooks.onRequest
        const onFinished = this._hooks.onFinished
        const onSend = this._hooks.onSend
        const preHandler = this._hooks.preHandler.concat(opts.beforeHandler || [])

        context.onRequest = onRequest.length ? onRequest : null
        context.preHandler = preHandler.length ? preHandler : null
        context.onSend = onSend.length ? onSend : null
        context.onFinished = onFinished.length ? onFinished : null

        // Must store the not-found Context in 'preReady' because it is only guaranteed
        // to be available after all of the plugins and routes have been loaded.
        context.notFoundContext = this._notFoundContexts.get(methodHandler)
      })

      done()
    })
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
    appInstance._subApps.forEach(child => _addHook(child, name, fn))
  }

  function addBodyParser(contentType, opts, parser) {
    throwIfAlreadyStarted('Cannot call "addBodyParser" when app is already loaded!')

    if (parser === undefined) {
      parser = opts
      opts = {}
    }

    validateBodyLimitOption(opts.bodyLimit)

    this._bodyParser.add(contentType, opts, parser)
    return this
  }

  function hasBodyParser(contentType) {
    return this._bodyParser.hasParser(contentType)
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAlreadyStarted('Cannot call "setNotFoundHandler" when app is already loaded!')

    const prefix = this._routePrefix || '/'

    if (this._canSetNotFoundHandler === false) {
      throw new Error(`Not found handler already set for app instance with prefix: '${prefix}'`)
    }

    this._notFoundLevelApp._canSetNotFoundHandler = false

    if (handler === undefined) {
      handler = opts
      opts = {}
    }

    const replaceDefault404 = prefix === '/' && handler !== defaultNotFoundHandler
    const serializers = buildSerializers(opts.responseSchema)
    const methodGroups = new Map()

    // Group up methods with the same methodHandler
    for (var i = 0; i < supportedMethods.length; i++) {
      const method = supportedMethods[i]
      const methodHandler = methodHandlers[method]

      if (methodGroups.has(methodHandler)) {
        methodGroups.get(methodHandler).push(method)
      } else {
        methodGroups.set(methodHandler, [method])
      }
    }

    this.after((err, done) => {
      if (err) {
        done(err)
        return
      }

      if (!replaceDefault404) {
        // Force a new context map to be created for the not-found level
        this._notFoundLevelApp._notFoundContexts = null
      }

      for (const [methodHandler, methods] of methodGroups) {
        _setNotFoundHandler.call(
          this,
          prefix,
          methods,
          methodHandler,
          opts,
          handler,
          serializers,
          replaceDefault404
        )
      }

      done()
    })

    return this
  }

  function _setNotFoundHandler(
    prefix,
    methods,
    methodHandler,
    opts,
    handler,
    serializers,
    replaceDefault404
  ) {
    const context = Context.create(
      this,
      serializers,
      methodHandler,
      handler,
      opts.config || {},
      opts.bodyLimit,
    )

    appLoader.once('preReady', () => {
      const notFoundContext = this._notFoundContexts.get(methodHandler)

      const onRequest = this._hooks.onRequest
      const preHandler = this._hooks.preHandler
      const onSend = this._hooks.onSend
      const onFinished = this._hooks.onFinished

      notFoundContext.onRequest = onRequest.length ? onRequest : null
      notFoundContext.preHandler = preHandler.length ? preHandler : null
      notFoundContext.onSend = onSend.length ? onSend : null
      notFoundContext.onFinished = onFinished.length ? onFinished : null
    })

    if (replaceDefault404) { // Replace the default 404 handler
      Object.assign(this._notFoundContexts.get(methodHandler), context)
      return
    }

    if (this._notFoundContexts === null) {
      // Set the context on the "_notFoundLevelApp" so that
      // it can be inherited by all of that app's children.
      this._notFoundLevelApp._notFoundContexts = new Map()
    }
    this._notFoundContexts.set(methodHandler, context)

    notFoundRouter.on(
      methods,
      prefix + (prefix.endsWith('/') ? '*' : '/*'),
      routeHandler,
      context
    )
    notFoundRouter.on(
      methods,
      prefix || '/',
      routeHandler,
      context
    )
  }

  function setErrorHandler(handler) {
    throwIfAlreadyStarted('Cannot call "setErrorHandler" when app is already loaded!')

    if (typeof handler !== 'function') {
      throw new TypeError(
        `Error handler must be a function. Got value with type '${typeof handler}': ${handler}`
      )
    }

    this._errorHandler = handler
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
