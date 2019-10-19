'use strict'

const debug = require('debug')('medley')
const http = require('http')

const Hooks = require('./lib/Hooks')
const RouteContext = require('./lib/RouteContext')
const Router = require('@medley/router')

const runOnCloseHandlers = require('./lib/utils/runOnCloseHandlers')
const runOnLoadHandlers = require('./lib/utils/runOnLoadHandlers')

const {buildRequest} = require('./lib/Request')
const {buildResponse} = require('./lib/Response')
const {buildSerializers} = require('./lib/Serializer')
const {
  createRequestHandler,
  defaultOptionsHandler,
  defaultMethodNotAllowedHandler,
  defaultNotFoundHandler,
} = require('./lib/RequestHandlers')

const kOptionalParamName = Symbol('optionalParamName')

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

  if (
    options.methodNotAllowedHandler !== undefined &&
    typeof options.methodNotAllowedHandler !== 'function'
  ) {
    throw new TypeError(`'methodNotAllowedHandler' option must be a function. Got value of type '${typeof options.methodNotAllowedHandler}'`)
  }

  const router = new Router({
    storeFactory: () => ({
      methodContexts: Object.create(null),
      fallbackContext: null, // For 405 Method Not Allowed responses
      optionalParamName: null,
    }),
  })
  const rootAppHooks = new Hooks()
  const onErrorSending = options.onErrorSending || defaultOnErrorSending
  const notFoundRouteContext = RouteContext.create(
    null, // Serializers
    options.notFoundHandler || defaultNotFoundHandler,
    undefined, // config
    undefined, // preHandler
    rootAppHooks,
    onErrorSending
  )
  const Request = buildRequest(!!options.trustProxy, options.queryParser)
  const Response = buildResponse()
  const requestHandler = createRequestHandler(router, notFoundRouteContext, Request, Response)
  const methodNotAllowedHandler = options.methodNotAllowedHandler || defaultMethodNotAllowedHandler

  var loadCallbackQueue = null
  var loaded = false
  var listenCallbackQueue = null

  const app = {
    server: options.server || null,

    get handler() {
      return loaded ? requestHandler : null
    },

    createSubApp,

    // Extension methods
    extend: extendApp,
    extendRequest,
    extendResponse,

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
    all: createShorthandRouteMethod(
      http.METHODS.filter(method => method !== 'CONNECT')
    ),

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

  function extendApp(name, value) {
    if (name in this) {
      throw new Error(`A '${name}' property already exists on the app`)
    }

    this[name] = value
    return this
  }

  function extendRequest(name, value) {
    if (name in Request.prototype) {
      throw new Error(`A '${name}' property already exists on the Request object`)
    }

    Request.prototype[name] = value
    return this
  }

  function extendResponse(name, value) {
    if (name in Response.prototype) {
      throw new Error(`A '${name}' property already exists on the Response object`)
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

    if (typeof opts.handler !== 'function') {
      throw new TypeError(
        `Route 'handler' must be a function. Got a value of type '${typeof opts.handler}': ${opts.handler}`
      )
    }

    let {path} = opts

    if (typeof path !== 'string') {
      throw new TypeError(`Route 'path' must be a string. Got a value of type '${typeof path}': ${path}`)
    }

    const optionalParamMatch = path.match(/(.*)\/(\*|:[^/]+)\?$/)

    if (optionalParamMatch !== null) {
      const isParam = optionalParamMatch[2] !== '*'

      if (optionalParamMatch[1] === '') {
        const type = isParam ? 'parameter' : 'wildcard'
        throw new Error(`Invalid route: ${path}\nCannot have an optional ${type} at the URL root`)
      }

      const paramName = isParam
        ? optionalParamMatch[2].slice(1) // Slice off leading ':'
        : optionalParamMatch[2]

      this.route({ // Register route for path without parameter/wildcard
        ...opts,
        path: optionalParamMatch[1],
        [kOptionalParamName]: paramName,
      })

      if (isParam) {
        this.route({ // Register route without parameter and with trailing `/`
          ...opts,
          path: optionalParamMatch[1] + '/',
          [kOptionalParamName]: paramName,
        })
      }

      path = path.slice(0, -1) // Slice off trailing '?' and continue
    }

    if (this._routePrefix.endsWith('/') && path.startsWith('/')) {
      path = this._routePrefix + path.slice(1)
    } else {
      path = this._routePrefix + path
    }

    const routeStore = router.register(path)
    const appRouteContexts = routeContexts.get(this) || routeContexts.set(this, []).get(this)

    if (routeStore.fallbackContext === null) { // Initial setup for new route store
      const config = {allowedMethods: []}

      // 405 Method Not Allowed context
      const fallbackContext = RouteContext.create(
        null, // serializers
        methodNotAllowedHandler,
        config,
        undefined, // preHandler
        rootAppHooks,
        onErrorSending
      )
      routeStore.fallbackContext = fallbackContext
      routeContexts.get(app).push(fallbackContext) // This is a root app context

      // Default OPTIONS context
      const optionsContext = RouteContext.create(
        null, // serializers
        defaultOptionsHandler,
        config,
        undefined, // preHandler
        this._hooks,
        onErrorSending
      )
      routeStore.methodContexts.OPTIONS = optionsContext
      appRouteContexts.push(optionsContext)

      if (opts[kOptionalParamName] !== undefined) {
        routeStore.optionalParamName = opts[kOptionalParamName]
      }
    }

    const routeContext = RouteContext.create(
      buildSerializers(opts.responseSchema),
      opts.handler,
      opts.config,
      opts.preHandler,
      this._hooks,
      onErrorSending
    )
    appRouteContexts.push(routeContext)

    const methods = Array.isArray(opts.method) ? opts.method : [opts.method]
    const userMethodContexts = routes.get(path) || routes.set(path, {}).get(path)
    const {allowedMethods} = routeStore.fallbackContext.config

    for (const method of methods) {
      // Throw if a context for the route + method already exists, unless it's
      // the default HEAD or OPTIONS context (in which case, replace it)
      const existingContext = routeStore.methodContexts[method]
      if (
        existingContext !== undefined &&
        (method !== 'HEAD' || existingContext !== routeStore.methodContexts.GET) &&
        (method !== 'OPTIONS' || existingContext.handler !== defaultOptionsHandler)
      ) {
        throw new Error(`Cannot create route "${method} ${path}" because it already exists`)
      }

      routeStore.methodContexts[method] = routeContext
      userMethodContexts[method] = routeContext

      if (method === 'GET' && routeStore.methodContexts.HEAD === undefined) {
        routeStore.methodContexts.HEAD = routeContext // Set default HEAD route
        allowedMethods.push('GET', 'HEAD')
      } else if (method !== 'HEAD' || !allowedMethods.includes('HEAD')) {
        allowedMethods.push(method)
      }
    }

    allowedMethods.sort() // Keep the allowed methods sorted to ensure consistency

    return this // Chainable
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
    for (const [routePath, methodContexts] of routes) {
      yield [routePath, methodContexts]
    }
  }
}

module.exports = medley
