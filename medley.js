'use strict'

const avvio = require('avvio')
const findMyWay = require('find-my-way')
const http = require('http')
const https = require('https')
const lightMyRequest = require('light-my-request')

const BodyParser = require('./lib/BodyParser')
const Hooks = require('./lib/Hooks')
const Response = require('./lib/Response')
const Request = require('./lib/Request')
const RouteContext = require('./lib/RouteContext')

const {
  kRegisteredPlugins,
  registerPlugin,
} = require('./lib/PluginUtils')
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

    use, // For sub-apps

    // Decorator methods
    decorate: decorateApp,
    decorateRequest,
    decorateResponse,

    // Body parsing
    addBodyParser,
    hasBodyParser,
    _bodyParser: new BodyParser(options.bodyLimit || DEFAULT_BODY_LIMIT),

    // Hooks
    addHook,
    _hooks: new Hooks(),

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
    _notFoundRouteContexts: null,

    setErrorHandler,
    _errorHandler: null,

    listen, // Starts the HTTP server
    inject, // Fake HTTP injection

    // Plugins
    registerPlugin,
    [kRegisteredPlugins]: [],

    _Request: Request.buildRequest(undefined, !!options.trustProxy),
    _Response: Response.buildResponse(),
    _subApps: [],
  }

  const appLoader = avvio(app, {
    autostart: false,
    expose: {use: '_register'},
  })
  appLoader.override = createSubApp // Override to allow plugin encapsulation

  var ready = false // true when plugins and sub-apps have loaded
  var listening = false // true when server is listening

  appLoader.on('start', () => {
    ready = true
  })

  function throwIfAppIsLoaded(msg) {
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

  app._notFoundLevelApp = app
  app.setNotFoundHandler(defaultNotFoundHandler)
  app._canSetNotFoundHandler = true // Allowed to override the default 404 handler

  return app

  function use(prefix, subAppFn) {
    if (subAppFn === undefined) {
      subAppFn = prefix
      prefix = ''
    }

    if (typeof prefix !== 'string') {
      throw new TypeError(`'prefix' must be a string. Got a value of type '${typeof prefix}': ${prefix}`)
    }
    if (typeof subAppFn !== 'function') {
      throw new TypeError(`'subAppFn' must be a function. Got a value of type '${typeof subAppFn}': ${subAppFn}`)
    }

    const subApp = createSubApp(this, null, {prefix})
    subAppFn(subApp)
  }

  function createSubApp(parentApp, fn, opts) {
    const subApp = Object.create(parentApp)

    parentApp._subApps.push(subApp)

    subApp._subApps = []
    subApp._Request = Request.buildRequest(parentApp._Request)
    subApp._Response = Response.buildResponse(parentApp._Response)
    subApp._bodyParser = parentApp._bodyParser.clone()
    subApp._hooks = Hooks.buildHooks(parentApp._hooks)
    subApp._routePrefix = buildRoutePrefix(parentApp._routePrefix, opts.prefix)
    subApp[kRegisteredPlugins] = parentApp[kRegisteredPlugins].slice()

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

  function decorateApp(name, fn) {
    if (name in this) {
      throw new Error(`A decorator called '${name}' has been already added`)
    }

    this[name] = fn
    return this
  }

  function decorateRequest(name, fn) {
    if (name in this._Request.prototype) {
      throw new Error(`A decorator called '${name}' has been already added to Request`)
    }

    this._Request.prototype[name] = fn
    return this
  }

  function decorateResponse(name, fn) {
    if (name in this._Response.prototype) {
      throw new Error(`A decorator called '${name}' has been already added to Response`)
    }

    this._Response.prototype[name] = fn
    return this
  }

  function addBodyParser(contentType, opts, parser) {
    throwIfAppIsLoaded('Cannot call "addBodyParser()" when app is already loaded')

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

  function addHook(name, fn) {
    throwIfAppIsLoaded('Cannot call "addHook()" when app is already loaded')

    this.after((err, done) => {
      if (err) {
        done(err)
        return
      }
      _addHook(this, name, fn)
      done()
    })

    return this
  }

  function _addHook(appInstance, name, fn) {
    appInstance._hooks.add(name, fn)
    appInstance._subApps.forEach(child => _addHook(child, name, fn))
  }

  // Routing methods
  function createShorthandRouteMethod(method) {
    return function(path, opts, handler) {
      if (handler === undefined) {
        if (typeof opts === 'function') {
          handler = opts
          opts = {}
        } else {
          handler = opts && opts.handler
        }
      }

      opts = Object.assign({}, opts, {
        method,
        path,
        handler,
      })

      return this.route(opts)
    }
  }

  function route(opts) {
    throwIfAppIsLoaded('Cannot add route when app is already loaded')

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
    var path = opts.path || opts.url
    if (path === '/' && prefix.length > 0) {
      // Ensure that '/prefix' + '/' gets registered as '/prefix'
      path = ''
    } else if (path[0] === '/' && prefix.endsWith('/')) {
      // Ensure that '/prefix/' + '/route' gets registered as '/prefix/route'
      path = path.slice(1)
    }
    path = prefix + path

    opts.path = opts.url = path
    opts.prefix = prefix

    for (const [methodHandler, method] of methodGroups) {
      _route.call(this, method, methodHandler, path, opts)
    }

    return this // Chainable
  }

  function _route(method, methodHandler, path, opts) {
    this.after((err, done) => {
      if (err) {
        done(err)
        return
      }

      var serializers
      try {
        serializers = buildSerializers(opts.responseSchema)
      } catch (err) {
        done(err)
        return
      }

      const routeContext = RouteContext.create(
        this,
        serializers,
        methodHandler,
        opts.handler,
        opts.config || {},
        opts.bodyLimit
      )

      try {
        router.on(method, path, routeHandler, routeContext)
      } catch (err) {
        done(err)
        return
      }

      // Users can add hooks *after* the route registration. To include those
      // hooks in the route, we must listen for the avvio's 'preReady' event
      // and update the routeContext object accordingly.
      appLoader.once('preReady', () => {
        const onRequest = this._hooks.onRequest
        const onFinished = this._hooks.onFinished
        const onSend = this._hooks.onSend
        const preHandler = this._hooks.preHandler.concat(opts.beforeHandler || [])

        routeContext.onRequest = onRequest.length ? onRequest : null
        routeContext.preHandler = preHandler.length ? preHandler : null
        routeContext.onSend = onSend.length ? onSend : null
        routeContext.onFinished = onFinished.length ? onFinished : null

        // Must store the not-found RouteContext in 'preReady' because it is only guaranteed
        // to be available after all of the plugins and routes have been loaded.
        routeContext.notFoundRouteContext = this._notFoundRouteContexts.get(methodHandler)
      })

      done()
    })
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAppIsLoaded('Cannot call "setNotFoundHandler()" when app is already loaded')

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
        this._notFoundLevelApp._notFoundRouteContexts = null
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
    const routeContext = RouteContext.create(
      this,
      serializers,
      methodHandler,
      handler,
      opts.config || {},
      opts.bodyLimit
    )

    appLoader.once('preReady', () => {
      const notFoundRouteContext = this._notFoundRouteContexts.get(methodHandler)

      const onRequest = this._hooks.onRequest
      const preHandler = this._hooks.preHandler
      const onSend = this._hooks.onSend
      const onFinished = this._hooks.onFinished

      notFoundRouteContext.onRequest = onRequest.length ? onRequest : null
      notFoundRouteContext.preHandler = preHandler.length ? preHandler : null
      notFoundRouteContext.onSend = onSend.length ? onSend : null
      notFoundRouteContext.onFinished = onFinished.length ? onFinished : null
    })

    if (replaceDefault404) { // Replace the default 404 handler
      Object.assign(this._notFoundRouteContexts.get(methodHandler), routeContext)
      return
    }

    if (this._notFoundRouteContexts === null) {
      // Set the routeContext on the "_notFoundLevelApp" so that
      // it can be inherited by all of that app's children.
      this._notFoundLevelApp._notFoundRouteContexts = new Map()
    }
    this._notFoundRouteContexts.set(methodHandler, routeContext)

    notFoundRouter.on(
      methods,
      prefix + (prefix.endsWith('/') ? '*' : '/*'),
      routeHandler,
      routeContext
    )
    notFoundRouter.on(
      methods,
      prefix,
      routeHandler,
      routeContext
    )
  }

  function setErrorHandler(handler) {
    throwIfAppIsLoaded('Cannot call "setErrorHandler()" when app is already loaded')

    if (typeof handler !== 'function') {
      throw new TypeError(
        `Error handler must be a function. Got value with type '${typeof handler}': ${handler}`
      )
    }

    this._errorHandler = handler
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
        cb(err)
        return
      }

      lightMyRequest(httpHandler, opts, cb)
    })

    return undefined
  }
}

function http2() {
  try {
    return require('http2')
  } catch (err) /* istanbul ignore next */ {
    console.error('http2 is available only from node >= 8.8.1') // eslint-disable-line no-console
    return undefined
  }
}

module.exports = medley
