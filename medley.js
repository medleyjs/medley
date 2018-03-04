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

  const medley = {
    _children: [],
    printRoutes: router.prettyPrint.bind(router),
  }

  const appLoader = avvio(medley, {
    autostart: false,
  })
  // Override to allow the plugin incapsulation
  appLoader.override = override

  var listening = false // true when server is listening
  var started = false // true when plugins and sub apps have loaded

  appLoader.on('start', () => {
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

  medley.onClose((app, done) => {
    if (listening) {
      app.server.close(done)
    } else {
      done(null)
    }
  })

  // body limit option
  validateBodyLimitOption(options.bodyLimit)
  medley._bodyLimit = options.bodyLimit || DEFAULT_BODY_LIMIT

  // shorthand methods
  medley.delete = _delete
  medley.get = _get
  medley.head = _head
  medley.patch = _patch
  medley.post = _post
  medley.put = _put
  medley.options = _options
  medley.all = _all
  // extended route
  medley.route = route
  medley._routePrefix = ''

  Object.defineProperty(medley, 'basePath', {
    get() {
      return this._routePrefix
    },
  })

  // hooks
  medley.addHook = addHook
  medley._hooks = new Hooks()

  const onRouteHooks = []

  // custom parsers
  medley.addContentTypeParser = addContentTypeParser
  medley.hasContentTypeParser = hasContentTypeParser
  medley._contentTypeParser = new ContentTypeParser(medley._bodyLimit)

  // plugin
  medley.register = medley.use
  medley.listen = listen
  medley.server = server
  medley[pluginUtils.registeredPlugins] = []

  // extend server methods
  medley.decorate = decorator.add
  medley.hasDecorator = decorator.exist
  medley.decorateReply = decorator.decorateReply
  medley.decorateRequest = decorator.decorateRequest

  medley._Reply = Reply.buildReply(Reply)
  medley._Request = Request.buildRequest(Request)

  // fake http injection
  medley.inject = inject

  var fourOhFour = findMyWay({defaultRoute: fourOhFourFallBack})
  medley.setNotFoundHandler = setNotFoundHandler
  medley._notFoundHandler = null
  medley._404Context = null
  medley.setNotFoundHandler(basic404) // Set the default 404 handler

  medley.setErrorHandler = setErrorHandler

  return medley

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
        medley.listen(port, host, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    medley.ready((err) => {
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

  function _route(_medley, method, url, opts, handler) {
    if (!handler && typeof opts === 'function') {
      handler = opts
      opts = {}
    }

    opts = Object.assign({}, opts, {
      method,
      url,
      handler,
    })

    return _medley.route(opts)
  }

  // Route management
  function route(opts) {
    throwIfAlreadyStarted('Cannot add route when app is already started!')

    const _medley = this

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

    _medley.after((err, done) => {
      if (err) {
        done(err)
        return
      }

      const prefix = _medley._routePrefix
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
        _medley,
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
        const onRequest = _medley._hooks.onRequest
        const onResponse = _medley._hooks.onResponse
        const onSend = _medley._hooks.onSend
        const preHandler = _medley._hooks.preHandler.concat(opts.beforeHandler || [])

        context.onRequest = onRequest.length ? onRequest : null
        context.preHandler = preHandler.length ? preHandler : null
        context.onSend = onSend.length ? onSend : null
        context.onResponse = onResponse.length ? onResponse : null
      })

      done()
    })

    // chainable api
    return _medley
  }

  function Context(app, serializers, handler, config, bodyLimit, storeApp) {
    this._jsonSerializers = serializers
    this.handler = handler
    this.config = config
    this._parserOptions = {
      limit: bodyLimit || null,
    }
    this.Reply = app._Reply
    this.Request = app._Request
    this.contentTypeParser = app._contentTypeParser
    this.errorHandler = app._errorHandler
    this.onRequest = null
    this.preHandler = null
    this.onSend = null
    this.onResponse = null
    this._appInstance = storeApp ? app : null
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
    throwIfAlreadyStarted('Cannot call "addHook" when app is already started!')

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

  function _addHook(app, name, fn) {
    app._hooks.add(name, fn)
    app._children.forEach(child => _addHook(child, name, fn))
  }

  function addContentTypeParser(contentType, opts, parser) {
    throwIfAlreadyStarted('Cannot call "addContentTypeParser" when app is already started!')

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

  function basic404(request, reply) {
    reply.code(404).send(new Error('Not found'))
  }

  function fourOhFourFallBack(req, res) {
    const request = new Request(null, req, null, req.headers)
    const reply = new Reply(res, {onSend: []}, request)

    reply.code(404).send(new Error('Not found'))
  }

  function setNotFoundHandler(opts, handler) {
    throwIfAlreadyStarted('Cannot call "setNotFoundHandler" when app is already started!')

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

    fourOhFour.all(prefix + (prefix.endsWith('/') ? '*' : '/*'), routeHandler, context)
    fourOhFour.all(prefix || '/', routeHandler, context)
  }

  function setErrorHandler(func) {
    throwIfAlreadyStarted('Cannot call "setErrorHandler" when app is already started!')

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
