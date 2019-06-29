'use strict'

const findMyWay = require('find-my-way')
const debug = require('debug')('medley')
const http = require('http')

const Hooks = require('./lib/Hooks')
const RouteContext = require('./lib/RouteContext')

const runOnCloseHandlers = require('./lib/utils/runOnCloseHandlers')
const runOnLoadHandlers = require('./lib/utils/runOnLoadHandlers')

const {buildRequest} = require('./lib/Request')
const {buildResponse} = require('./lib/Response')
const {buildSerializers} = require('./lib/Serializer')
const {
  createRequestHandler,
  createOptionsHandler,
  create405Handler,
  defaultNotFoundHandler,
} = require('./lib/RequestHandlers')

const supportedMethods = http.METHODS.filter(method => method !== 'CONNECT')

/* istanbul ignore next - This is never used. It's just needed to appease find-my-way. */
const noop = () => {}

function defaultOnErrorSending(err) {
  debug('Error occurred while sending:\n%O', err)
}

function createServer(options) {
  if (options.http2) {
    if (typeof options.http2 === 'object') {
      return options.http2.key || options.http2.cert
        ? require('http2').createSecureServer(options.http2)
        : require('http2').createServer(options.http2)
    }

    return require('http2').createServer()
  }

  if (options.https) {
    return require('https').createServer(options.https)
  }

  return http.createServer()
}

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

function medley(options) {
  options = options || {}

  if (options.queryParser !== undefined && typeof options.queryParser !== 'function') {
    throw new TypeError(`'queryParser' option must be a function. Got value of type '${typeof options.queryParser}'`)
  }

  if (options.onErrorSending !== undefined && typeof options.onErrorSending !== 'function') {
    throw new TypeError(`'onErrorSending' option must be a function. Got value of type '${typeof options.onErrorSending}'`)
  }

  if (options.notFoundHandler !== undefined && typeof options.notFoundHandler !== 'function') {
    throw new TypeError(`'notFoundHandler' option must be a function. Got value of type '${typeof options.notFoundHandler}'`)
  }

  const router = findMyWay({
    ignoreTrailingSlash: !options.strictRouting,
    maxParamLength: options.maxParamLength,
  })
  const rootAppHooks = new Hooks()
  const onErrorSending = options.onErrorSending || defaultOnErrorSending
  const notFoundRouteContext = RouteContext.create(
    null, // Serializers
    options.notFoundHandler || defaultNotFoundHandler,
    undefined, // config
    null, // preHandler
    rootAppHooks,
    onErrorSending
  )
  const notFoundRoute = {
    handler: noop, // To match shape of find-my-way routes
    params: {},
    store: notFoundRouteContext,
  }
  const Request = buildRequest(!!options.trustProxy, options.queryParser)
  const Response = buildResponse()
  const requestHandler = createRequestHandler(router, notFoundRoute, Request, Response)

  var loadCallbackQueue = null
  var loaded = false
  var listenCallbackQueue = null

  const app = {
    server: options.server || null,

    get handler() {
      return loaded ? requestHandler : null
    },

    createSubApp,

    // Decorator methods
    decorate: decorateApp,
    decorateRequest,
    decorateResponse,

    // Hooks
    addHook,
    _hooks: rootAppHooks,

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

    [Symbol.iterator]: routesIterator,

    get basePath() {
      return this._routePrefix
    },
    _routePrefix: '/',

    // App setup
    onLoad,
    load,

    // App teardown
    onClose,
    close,

    listen, // Starts the HTTP server

    // Helper for registering plugins
    register(plugin, opts) {
      plugin(this, opts)
      return this
    },
  }

  const routes = new Map()
  const routeContexts = new Map([
    [app, [notFoundRouteContext]],
  ])

  const onLoadHandlers = []
  const onCloseHandlers = []

  var registeringAutoHandlers = false

  function throwIfAppIsLoaded(msg) {
    if (loaded) {
      throw new Error(msg)
    }
  }

  app.onClose((done) => {
    const {server} = app
    if (server !== null && server.listening) {
      server.close(done)
    } else {
      done(null)
    }
  })

  return app

  function createSubApp(prefix = '') {
    if (typeof prefix !== 'string') {
      throw new TypeError(`'prefix' must be a string. Got a value of type '${typeof prefix}': ${prefix}`)
    }

    const subApp = Object.create(this)

    subApp._hooks = this._hooks.clone()

    if (prefix.length > 0) {
      if (prefix[0] !== '/') {
        throw new Error(`'prefix' must start with a '/' character. Got: '${prefix}'`)
      }

      subApp._routePrefix += subApp._routePrefix.endsWith('/') ? prefix.slice(1) : prefix
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
    if (name in Request.prototype) {
      throw new Error(`A decorator called '${name}' has already been added to Request`)
    }

    Request.prototype[name] = value
    return this
  }

  function decorateResponse(name, value) {
    if (name in Response.prototype) {
      throw new Error(`A decorator called '${name}' has already been added to Response`)
    }

    Response.prototype[name] = value
    return this
  }

  function addHook(hookName, hookHandler) {
    throwIfAppIsLoaded('Cannot call "addHook()" when app is already loaded')

    this._hooks.add(hookName, hookHandler)

    return this
  }

  function route(opts) {
    throwIfAppIsLoaded('Cannot add route when app is already loaded')

    if (opts.method === undefined) {
      throw new TypeError('Route `method` is required')
    }

    const methods = Array.isArray(opts.method) ? opts.method : [opts.method]

    for (const method of methods) {
      if (supportedMethods.indexOf(method) === -1) {
        throw new RangeError(`"${method}" method is not supported`)
      }
    }

    let {path} = opts

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
    const routeContext = RouteContext.create(
      serializers,
      opts.handler,
      opts.config,
      opts.preHandler,
      this._hooks,
      onErrorSending
    )

    router.on(methods, path, noop, routeContext)

    if (!registeringAutoHandlers) {
      recordRoute(path, methods, routeContext, this)

      const appRouteContexts = routeContexts.get(this)
      if (appRouteContexts === undefined) {
        routeContexts.set(this, [routeContext])
      } else {
        appRouteContexts.push(routeContext)
      }
    }

    return this // Chainable
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
        router.on('HEAD', routePath, noop, methodRoutes.GET)
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

  function onLoad(handler) {
    onLoadHandlers.push(handler.bind(this))
    return this
  }

  /* eslint-disable consistent-return */
  function load(cb) {
    if (loaded) {
      return cb ? process.nextTick(cb) : Promise.resolve()
    }

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

    if (loadCallbackQueue !== null) {
      loadCallbackQueue.push(cb)
      return
    }

    loadCallbackQueue = [cb]

    runOnLoadHandlers(onLoadHandlers, (err) => {
      if (err) {
        loadCallbackQueue.forEach(callback => callback(err))
        loadCallbackQueue = null
        return
      }

      registeringAutoHandlers = true
      registerAutoHandlers()

      loaded = true

      // Hooks can be added after a route context is created, so update
      // the route contexts with any new hooks
      for (const [appInstance, appRouteContexts] of routeContexts) {
        for (const routeContext of appRouteContexts) {
          RouteContext.updateHooks(routeContext, appInstance._hooks)
        }
        appInstance._hooks = null // No longer needed, so save memory
      }
      routeContexts.clear()

      loadCallbackQueue.forEach(callback => callback())
      loadCallbackQueue = null
    })
  }

  function listen(port, host, backlog, cb) {
    if (app.server === null) {
      app.server = createServer(options)
    }

    const {server} = app

    if (server.listening) {
      throw new Error('.listen() called while server is already listening')
    }

    if (port === undefined) { // listen()
      port = 0
    } else if (typeof port === 'function') { // listen(cb)
      cb = port
      port = 0
    } else if (typeof host === 'function') { // listen(port, cb)
      cb = host
      host = undefined
    } else if (typeof backlog === 'function') { // listen(port, host, cb)
      cb = backlog
      backlog = undefined
    }

    host = host || 'localhost'

    if (cb === undefined) {
      return new Promise((resolve, reject) => {
        this.listen(port, host, backlog, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    if (listenCallbackQueue !== null) {
      listenCallbackQueue.push(cb)
      return
    }

    listenCallbackQueue = [cb]
    server.on('request', requestHandler)

    load((err) => {
      if (err) {
        cb(err)
        return
      }

      function handleListeningOrError(err) {
        server.removeListener('listening', handleListeningOrError)
        server.removeListener('error', handleListeningOrError)

        for (const callback of listenCallbackQueue) {
          callback(err)
        }

        listenCallbackQueue = null
      }

      server.on('listening', handleListeningOrError)
      server.on('error', handleListeningOrError)

      server.listen(port, host, backlog)
    })
  }
  /* eslint-enable consistent-return */

  function onClose(handler) {
    onCloseHandlers.push(handler.bind(this))
    return this
  }

  function close(cb = () => {}) {
    runOnCloseHandlers(onCloseHandlers, cb)
  }

  function *routesIterator() {
    for (const [routePath, {methodRoutes}] of routes) {
      yield [routePath, methodRoutes]
    }
  }
}

module.exports = medley
