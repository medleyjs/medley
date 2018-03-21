'use strict'

const findMyWay = require('find-my-way')
const http = require('http')
const https = require('https')
const lightMyRequest = require('light-my-request')

const BodyParser = require('./lib/BodyParser')
const Hooks = require('./lib/Hooks')
const Response = require('./lib/Response')
const Request = require('./lib/Request')
const RouteContext = require('./lib/RouteContext')

const runOnCloseHandlers = require('./lib/utils/runOnCloseHandlers')
const runOnLoadHandlers = require('./lib/utils/runOnLoadHandlers')

const {buildSerializers} = require('./lib/Serializer')
const {
  kRegisteredPlugins,
  registerPlugin,
} = require('./lib/PluginUtils')
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
    ignoreTrailingSlash: !options.strictRouting,
    maxParamLength: options.maxParamLength,
  })
  const httpHandler = router.lookup.bind(router)

  var server
  if (options.http2) {
    if (typeof options.http2 === 'object') {
      if (options.http2.key || options.http2.cert) {
        server = http2().createSecureServer(options.http2, httpHandler)
      } else {
        server = http2().createServer(options.http2, httpHandler)
      }
    } else {
      server = http2().createServer(httpHandler)
    }
  } else if (options.https) {
    server = https.createServer(options.https, httpHandler)
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

    // App setup
    onLoad,
    load,

    // App teardown
    _onCloseHandlers: [],
    onClose,
    close,

    listen, // Starts the HTTP server
    inject, // Fake HTTP injection

    // Plugins
    registerPlugin,
    [kRegisteredPlugins]: [],

    _Request: Request.buildRequest(undefined, !!options.trustProxy),
    _Response: Response.buildResponse(),
    _subApps: [],
  }
  app._notFoundLevelApp = app

  for (const method of supportedMethods) {
    app[method.toLowerCase()] = createShorthandRouteMethod(method)
  }

  const onLoadHandlers = []
  const preLoadedHandlers = [] // Internal, synchronous handlers

  var loaded = false // true when all onLoad handlers have finished

  function throwIfAppIsLoaded(msg) {
    if (loaded) {
      throw new Error(msg)
    }
  }

  app.onClose((done) => {
    if (app.server.listening) {
      app.server.close(done)
    } else {
      done(null)
    }
  })

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

    const subApp = createSubApp(this, prefix)
    subAppFn(subApp)
  }

  function createSubApp(parentApp, prefix) {
    const subApp = Object.create(parentApp)

    parentApp._subApps.push(subApp)

    subApp._subApps = []
    subApp._Request = Request.buildRequest(parentApp._Request)
    subApp._Response = Response.buildResponse(parentApp._Response)
    subApp._bodyParser = parentApp._bodyParser.clone()
    subApp._hooks = Hooks.buildHooks(parentApp._hooks)
    subApp._routePrefix = buildRoutePrefix(parentApp._routePrefix, prefix)
    subApp[kRegisteredPlugins] = parentApp[kRegisteredPlugins].slice()

    if (prefix) {
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

    _addHook(this, name, fn)

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

    const serializers = buildSerializers(opts.responseSchema)
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
    opts.config = opts.config || {}

    for (const [methodHandler, method] of methodGroups) {
      _route.call(this, method, methodHandler, path, opts, serializers)
    }

    return this // Chainable
  }

  function _route(method, methodHandler, path, opts, serializers) {
    const routeContext = RouteContext.create(
      this,
      serializers,
      methodHandler,
      opts.handler,
      opts.config,
      opts.bodyLimit
    )

    router.on(method, path, routeHandler, routeContext)

    // Users can add hooks, an error handler, and a not-found handler after
    // the route is registered, so add these to the routeContext just before
    // the app is loaded.
    preLoadedHandlers.push(() => {
      const onRequest = this._hooks.onRequest
      const onFinished = this._hooks.onFinished
      const onSend = this._hooks.onSend
      const preHandler = this._hooks.preHandler.concat(opts.beforeHandler || [])

      routeContext.onRequest = onRequest.length ? onRequest : null
      routeContext.preHandler = preHandler.length ? preHandler : null
      routeContext.onSend = onSend.length ? onSend : null
      routeContext.onFinished = onFinished.length ? onFinished : null

      routeContext.notFoundRouteContext = this._notFoundRouteContexts.get(methodHandler)
      routeContext.errorHandler = this._errorHandler
    })
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAppIsLoaded('Cannot call "setNotFoundHandler()" when app is already loaded')

    const prefix = this._routePrefix || '/'

    if (this._canSetNotFoundHandler === false) {
      throw new Error(`Not found handler already set for app instance with prefix: '${prefix}'`)
    }

    // Set values on the "_notFoundLevelApp" so that they
    // can be inherited by all of that app's children.
    this._notFoundLevelApp._canSetNotFoundHandler = false
    this._notFoundLevelApp._notFoundRouteContexts = new Map()

    if (handler === undefined) {
      handler = opts
      opts = {}
    }

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

    opts.config = opts.config || {}

    for (const [methodHandler, methods] of methodGroups) {
      _setNotFoundHandler.call(
        this,
        prefix,
        methods,
        methodHandler,
        opts,
        handler,
        serializers
      )
    }

    return this
  }

  function _setNotFoundHandler(
    prefix,
    methods,
    methodHandler,
    opts,
    handler,
    serializers
  ) {
    const routeContext = RouteContext.create(
      this,
      serializers,
      methodHandler,
      handler,
      opts.config,
      opts.bodyLimit
    )

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

    preLoadedHandlers.push(() => {
      const notFoundRouteContext = this._notFoundRouteContexts.get(methodHandler)

      const onRequest = this._hooks.onRequest
      const preHandler = this._hooks.preHandler
      const onSend = this._hooks.onSend
      const onFinished = this._hooks.onFinished

      notFoundRouteContext.onRequest = onRequest.length ? onRequest : null
      notFoundRouteContext.preHandler = preHandler.length ? preHandler : null
      notFoundRouteContext.onSend = onSend.length ? onSend : null
      notFoundRouteContext.onFinished = onFinished.length ? onFinished : null

      notFoundRouteContext.errorHandler = this._errorHandler
    })
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

  function onLoad(handler) {
    onLoadHandlers.push(handler.bind(this))
    return this
  }

  function load(cb) {
    if (!cb) {
      return new Promise((resolve, reject) => {
        load((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    if (loaded) {
      process.nextTick(cb)
      return undefined
    }

    return runOnLoadHandlers(onLoadHandlers, (err) => {
      if (err) {
        cb(err)
        return
      }

      if (app._canSetNotFoundHandler) {
        app.setNotFoundHandler(defaultNotFoundHandler)
      }
      loaded = true
      preLoadedHandlers.forEach(handler => handler())
      cb(null)
    })
  }

  function onClose(handler) {
    this._onCloseHandlers.push(handler.bind(this))
    return this
  }

  function close(cb = () => {}) {
    runOnCloseHandlers(this._onCloseHandlers, cb)
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

    this.load((err) => {
      if (err) {
        cb(err)
        return
      }
      if (this.server.listening) {
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
    })

    return undefined
  }

  function inject(opts, cb) {
    if (loaded) {
      return lightMyRequest(httpHandler, opts, cb)
    }

    if (!cb) {
      return new Promise((resolve, reject) => {
        this.load((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }).then(() => lightMyRequest(httpHandler, opts))
    }

    this.load((err) => {
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
    throw new Error('http2 is available only from Node >= 8.8.0')
  }
}

module.exports = medley
