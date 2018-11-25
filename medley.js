'use strict'

const findMyWay = require('find-my-way')
const http = require('http')

const BodyParser = require('./lib/BodyParser')
const Hooks = require('./lib/Hooks')
const Response = require('./lib/Response')
const Request = require('./lib/Request')
const RouteContext = require('./lib/RouteContext')

const runOnCloseHandlers = require('./lib/utils/runOnCloseHandlers')
const runOnLoadHandlers = require('./lib/utils/runOnLoadHandlers')

const {buildSerializers} = require('./lib/Serializer')
const {kRegisteredPlugins, register} = require('./lib/PluginUtils')
const {
  routeHandler,
  methodHandlers: originalMethodHandlers,
  createOptionsHandler,
  create405Handler,
  defaultNotFoundHandler,
  notFoundFallbackHandler,
} = require('./lib/RequestHandlers')

const kIsNotFoundHandlerSet = Symbol('isNotFoundHandlerSet')

const supportedMethods = Object.keys(originalMethodHandlers)

function medley(options) {
  options = options || {}
  if (typeof options !== 'object') {
    throw new TypeError('Options must be an object')
  }

  const methodHandlers = Object.assign({}, originalMethodHandlers)

  if (options.extraBodyParsingMethods) {
    for (const method of options.extraBodyParsingMethods) {
      if (supportedMethods.indexOf(method) === -1) {
        throw new RangeError(`"${method}" in the 'extraBodyParsingMethods' option is not a supported method (make sure it is UPPERCASE)`)
      }
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'OPTIONS') {
        throw new RangeError(`Bodies are already parsed for "${method}" requests`)
      }
      // Parse the method's bodies using the semantics of an OPTIONS request
      methodHandlers[method] = originalMethodHandlers.OPTIONS
    }
  }

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
    server = require('https').createServer(options.https, httpHandler)
  } else {
    server = http.createServer(httpHandler)
  }

  const app = {
    server,
    _onStreamError: options.onStreamError || function noop() {},

    encapsulate, // For creating sub-apps
    _subApps: [],

    // Decorator methods
    decorate: decorateApp,
    decorateRequest,
    decorateResponse,

    // Body parsing
    addBodyParser,
    _bodyParser: new BodyParser(!!options.allowUnsupportedMediaTypes),

    // Hooks
    addHook,
    _hooks: new Hooks(),

    // Routing
    route,
    get: createShorthandRouteMethod('GET'),
    head: createShorthandRouteMethod('HEAD'),
    delete: createShorthandRouteMethod('DELETE'),
    post: createShorthandRouteMethod('POST'),
    put: createShorthandRouteMethod('PUT'),
    patch: createShorthandRouteMethod('PATCH'),
    options: createShorthandRouteMethod('OPTIONS'),
    all: createShorthandRouteMethod(supportedMethods),

    get basePath() {
      return this._routePrefix
    },
    _routePrefix: '/',

    setNotFoundHandler,
    [kIsNotFoundHandlerSet]: false,

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
    register,
    [kRegisteredPlugins]: [],

    // For debugging routes
    [Symbol.iterator]: routesIterator,
    routesToString,

    _Request: Request.buildRequest(!!options.trustProxy),
    _Response: Response.buildResponse(),
  }

  const routes = new Map()
  const onLoadHandlers = []
  const preLoadedHandlers = [] // Internal, synchronous handlers

  var registeringAutoHandlers = false

  var loadCallbackQueue = []
  var loading = false
  var loaded = false

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

  function encapsulate(prefix, subAppFn) {
    if (subAppFn === undefined) {
      subAppFn = prefix
      prefix = ''
    }

    if (typeof prefix !== 'string') {
      throw new TypeError(`'prefix' must be a string. Got a value of type '${typeof prefix}': ${prefix}`)
    }
    if (prefix !== '' && prefix[0] !== '/') {
      throw new Error(`'prefix' must start with a '/' character. Got: '${prefix}'`)
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
    subApp._bodyParser = parentApp._bodyParser.clone()
    subApp._hooks = Hooks.buildHooks(parentApp._hooks)
    subApp[kRegisteredPlugins] = parentApp[kRegisteredPlugins].slice()

    if (prefix.length > 0) {
      subApp._routePrefix += subApp._routePrefix.endsWith('/') ? prefix.slice(1) : prefix
      subApp[kIsNotFoundHandlerSet] = false
    }

    return subApp
  }

  function decorateApp(name, value) {
    if (name in this) {
      throw new Error(`A decorator called '${name}' has already been added`)
    }

    this[name] = value
    return this
  }

  function decorateRequest(name, value) {
    if (name in this._Request.prototype) {
      throw new Error(`A decorator called '${name}' has already been added to Request`)
    }

    this._Request.prototype[name] = value
    return this
  }

  function decorateResponse(name, value) {
    if (name in this._Response.prototype) {
      throw new Error(`A decorator called '${name}' has already been added to Response`)
    }

    this._Response.prototype[name] = value
    return this
  }

  function addBodyParser(contentType, parser) {
    throwIfAppIsLoaded('Cannot call "addBodyParser()" when app is already loaded')

    this._bodyParser.add(contentType, parser)
    this._subApps.forEach(subApp => subApp.addBodyParser(contentType, parser))

    return this
  }

  function addHook(hookName, hookHandler) {
    throwIfAppIsLoaded('Cannot call "addHook()" when app is already loaded')

    this._hooks.add(hookName, hookHandler)
    this._subApps.forEach(subApp => subApp.addHook(hookName, hookHandler))

    return this
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
      } else if (Array.isArray(opts)) {
        opts = {preHandler: opts}
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

    if (opts.method === undefined) {
      throw new TypeError('Route `method` is required')
    }

    const methods = Array.isArray(opts.method) ? opts.method : [opts.method]
    const methodGroups = new Map()

    // Group up methods with the same methodHandler
    for (var i = 0; i < methods.length; i++) {
      const method = methods[i]
      const methodHandler = methodHandlers[method]

      if (methodHandler === undefined) {
        throw new RangeError(`"${method}" method is not supported`)
      }

      if (methodGroups.has(methodHandler)) {
        methodGroups.get(methodHandler).push(method)
      } else {
        methodGroups.set(methodHandler, [method])
      }
    }

    var {path} = opts

    if (typeof path !== 'string') {
      throw new TypeError(`Route 'path' must be a string. Got a value of type '${typeof path}': ${path}`)
    }

    if (this._routePrefix.endsWith('/') && path.startsWith('/')) {
      path = this._routePrefix + path.slice(1)
    } else {
      path = this._routePrefix + path
    }

    if (typeof opts.handler !== 'function') {
      throw new TypeError(
        `Route 'handler' must be a function. Got a value of type '${typeof opts.handler}': ${opts.handler}`
      )
    }

    const serializers = buildSerializers(opts.responseSchema)
    opts.config = opts.config || {}

    for (const [methodHandler, methodNames] of methodGroups) {
      _route.call(this, methodNames, methodHandler, path, opts, serializers)
    }

    return this // Chainable
  }

  function _route(methods, methodHandler, path, opts, serializers) {
    const routeContext = RouteContext.create(
      this,
      serializers,
      methodHandler,
      opts.handler,
      opts.config
    )

    router.on(methods, path, routeHandler, routeContext)

    if (!registeringAutoHandlers) {
      recordRoute(path, methods, routeContext, this)
    }

    // Users can add hooks and error handlers after the route is registered,
    // so add these to the routeContext just before the app is loaded.
    preLoadedHandlers.push(() => {
      RouteContext.setHooks(routeContext, this._hooks, opts.preHandler)
      routeContext.errorHandler = this._errorHandler
    })
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAppIsLoaded('Cannot call "setNotFoundHandler()" when app is already loaded')

    if (!this.hasOwnProperty('_routePrefix')) {
      throw new Error('Cannot call "setNotFoundHandler()" on a sub-app created without a prefix')
    }

    const prefix = this._routePrefix

    if (this[kIsNotFoundHandlerSet]) {
      throw new Error(`Not found handler already set for app instance with prefix: '${prefix}'`)
    }

    this[kIsNotFoundHandlerSet] = true

    if (handler === undefined) {
      handler = opts
      opts = {}
    }

    const serializers = buildSerializers(opts.responseSchema)
    const routeContext = RouteContext.create(
      this,
      serializers,
      originalMethodHandlers.GET, // Use the GET handler to avoid running the body parser
      handler,
      opts.config || {}
    )

    if (prefix.endsWith('/')) {
      notFoundRouter.on(supportedMethods, prefix + '*', routeHandler, routeContext)
    } else {
      notFoundRouter.on(supportedMethods, prefix, routeHandler, routeContext)
      notFoundRouter.on(supportedMethods, prefix + '/*', routeHandler, routeContext)
    }

    preLoadedHandlers.push(() => {
      RouteContext.setHooks(routeContext, this._hooks, opts.preHandler)
      routeContext.errorHandler = this._errorHandler
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

  function onClose(handler) {
    this._onCloseHandlers.push(handler.bind(this))
    return this
  }

  function close(cb = () => {}) {
    runOnCloseHandlers(this._onCloseHandlers, cb)
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

    if (loading) {
      loadCallbackQueue.push(cb)
      return undefined
    }

    loading = true

    return runOnLoadHandlers(onLoadHandlers, (err) => {
      if (err) {
        cb(err)
        return
      }

      if (!app[kIsNotFoundHandlerSet]) {
        app.setNotFoundHandler(defaultNotFoundHandler)
      }

      registeringAutoHandlers = true
      registerAutoHandlers()

      loaded = true
      preLoadedHandlers.forEach(handler => handler())

      cb(null)

      loadCallbackQueue.forEach(callback => callback())
    })
  }

  function recordRoute(routePath, methods, routeContext, appInstance) {
    const methodRoutes = {}
    for (var i = 0; i < methods.length; i++) {
      methodRoutes[methods[i]] = routeContext
    }

    if (!routes.has(routePath)) {
      routes.set(routePath, {appInstance, methodRoutes})
      return
    }

    const routeData = routes.get(routePath)
    Object.assign(routeData.methodRoutes, methodRoutes)
  }

  function registerAutoHandlers() {
    for (const [routePath, routeData] of routes) {
      const {methodRoutes} = routeData
      const methods = Object.keys(methodRoutes)

      // Create a HEAD handler if a GET handler was set and a HEAD handler wasn't
      if (methodRoutes.GET !== undefined && methodRoutes.HEAD === undefined) {
        router.on('HEAD', routePath, routeHandler, methodRoutes.GET)
        methods.push('HEAD')
      }

      methods.sort() // For consistent Allow headers

      // Create an OPTIONS handler if one wasn't set
      const optionsIndex = methods.indexOf('OPTIONS')
      if (optionsIndex === -1) {
        const optionsHandler = createOptionsHandler(methods.join(','))
        routeData.appInstance.options(routePath, optionsHandler)
      } else {
        // Remove OPTIONS for the next part
        methods.splice(optionsIndex, 1)
      }

      // Create a 405 handler for all unset, supported methods
      const unsetMethods = supportedMethods.filter(
        method => method !== 'OPTIONS' && methods.indexOf(method) === -1
      )
      if (unsetMethods.length > 0) {
        routeData.appInstance.route({
          method: unsetMethods,
          path: routePath,
          handler: create405Handler(methods.join(',')),
        })
      }

      // Try to save memory since this is no longer needed
      routeData.appInstance = null
    }
  }

  function listen(port, host, backlog, cb) {
    // Handle listen (port, cb)
    if (typeof host === 'function') {
      cb = host
      host = undefined
    }
    host = host || 'localhost'

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

    return load((err) => {
      if (err) {
        cb(err)
        return
      }

      if (this.server.listening) {
        cb(new Error('app is already listening'))
        return
      }

      function handleListeningOrError(err) {
        server.removeListener('listening', handleListeningOrError)
        server.removeListener('error', handleListeningOrError)
        cb(err)
      }

      server.on('listening', handleListeningOrError)
      server.on('error', handleListeningOrError)

      server.listen(port, host, backlog)
    })
  }

  function inject(opts, cb) {
    const lightMyRequest = require('light-my-request')

    if (loaded) {
      return lightMyRequest(httpHandler, opts, cb)
    }

    if (!cb) {
      return new Promise((resolve, reject) => {
        inject(opts, (err, response) => {
          if (err) {
            reject(err)
          } else {
            resolve(response)
          }
        })
      })
    }

    return load((err) => {
      if (err) {
        cb(err)
      } else {
        lightMyRequest(httpHandler, opts, cb)
      }
    })
  }

  function *routesIterator() {
    for (const [routePath, {methodRoutes}] of routes) {
      yield [routePath, methodRoutes]
    }
  }

  function routesToString() {
    let str = ''

    for (const [routePath, {methodRoutes}] of routes) {
      if (str !== '') {
        str += '\n'
      }
      str += routePath + ' (' + Object.keys(methodRoutes).join(',') + ')'
    }

    return str
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
