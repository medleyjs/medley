'use strict'

const t = require('tap')
const fs = require('fs')
const medley = require('..')
const path = require('path')
const request = require('./utils/request')

const Request = require('../lib/Request').buildRequest(false)

t.test('Request object', (t) => {
  t.plan(5)
  const req = new Request('reqStream', 'headers', 'params')
  t.type(req, Request)
  t.equal(req.stream, 'reqStream')
  t.equal(req.headers, 'headers')
  t.equal(req.params, 'params')
  t.equal(req.body, undefined)
})

t.test('req.authority is an alias for req.host', (t) => {
  t.strictDeepEqual(
    Object.getOwnPropertyDescriptor(Request.prototype, 'authority'),
    Object.getOwnPropertyDescriptor(Request.prototype, 'host')
  )
  t.end()
})

t.test('req.body should be available in onSend hooks and undefined in onFinished hooks', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    req.body = 'body'
    res.send()
  })

  app.addHook('onSend', (req, res, payload, next) => {
    t.equal(req.body, 'body')
    next()
  })

  app.addHook('onFinished', (req) => {
    t.equal(req.body, undefined)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
  })
})

t.test('req.body should be undefined in onFinished hooks if the default error response is sent', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    req.body = 'body'
    res.error(new Error('Manual error'))
  })

  app.addHook('onFinished', (req) => {
    t.equal(req.body, undefined)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.body).message, 'Manual error')
  })
})

t.test('req.host - trustProxy=false', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.host)
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'justhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'justhost.com')
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'justhost.com',
      'X-Forwarded-Host': 'forwardedhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'justhost.com')
  })
})

t.test('req.host - trustProxy=true', (t) => {
  t.plan(6)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.host)
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'justhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'justhost.com')
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'justhost.com',
      'X-Forwarded-Host': 'forwardedhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'forwardedhost.com')
  })
})

t.test('req.hostname - no HOST', (t) => {
  const headers = {}
  t.equal(new Request({headers}, headers).hostname, undefined)
  t.end()
})

t.test('req.hostname - trustProxy=false', (t) => {
  t.plan(15)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.hostname)
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'host.com',
      'X-Forwarded-Host': 'xhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'host.com')
  })

  request(app, {
    url: '/',
    headers: {
      Host: '[::1]',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '[::1]')
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'host.com:8080',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'host.com')
  })

  request(app, {
    url: '/',
    headers: {
      Host: '[::1]:8080',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '[::1]')
  })

  request(app, {
    url: '/',
    headers: {
      Host: '[2001:db8:85a3::8a2e:370:7334]',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '[2001:db8:85a3::8a2e:370:7334]')
  })
})

t.test('req.hostname - trustProxy=true', (t) => {
  t.plan(3)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.hostname)
  })

  request(app, {
    url: '/',
    headers: {
      Host: 'host.com:80',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'host.com')
  })
})

t.test('req.href - trustProxy=false', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/*', (req, res) => {
    res.send(req.href)
  })

  request(app, {
    url: '/status/user?name=medley',
    headers: {
      'X-Forwarded-Host': 'xhost.com',
      'X-Forwarded-Proto': 'https',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, `http://localhost:${app.server.address().port}/status/user?name=medley`)
  })
})

t.test('req.href - trustProxy=true', (t) => {
  t.plan(6)

  const app = medley({trustProxy: true})

  app.get('/*', (req, res) => {
    res.send(req.href)
  })

  request(app, '/status/user/?name=medley', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, `http://localhost:${app.server.address().port}/status/user/?name=medley`)
  })

  request(app, {
    url: '/status/user/?name=medley',
    headers: {
      'X-Forwarded-Host': 'xhost.com',
      'X-Forwarded-Proto': 'https',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'https://xhost.com/status/user/?name=medley')
  })
})

t.test('request.method - get', (t) => {
  const req = {method: 'GET'}
  t.equal(new Request(req).method, 'GET')
  t.end()
})

t.test('req.origin - trustProxy=false', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.origin)
  })

  request(app, {
    url: '/',
    headers: {
      'X-Forwarded-Host': 'xhost.com',
      'X-Forwarded-Proto': 'https',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, `http://localhost:${app.server.address().port}`)
  })
})

t.test('req.origin - trustProxy=true', (t) => {
  t.plan(6)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.origin)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, `http://localhost:${app.server.address().port}`)
  })

  request(app, {
    url: '/',
    headers: {
      'X-Forwarded-Host': 'xhost.com',
      'X-Forwarded-Proto': 'https',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'https://xhost.com')
  })
})

t.test('req.path - get', (t) => {
  t.equal(new Request({url: '/'}).path, '/')
  t.equal(new Request({url: '/no-query'}).path, '/no-query')
  t.equal(new Request({url: '/?'}).path, '/')
  t.equal(new Request({url: '/path?'}).path, '/path')
  t.equal(new Request({url: '/path?search=1'}).path, '/path')
  t.equal(new Request({url: '/with/multi/parts?qu?ery'}).path, '/with/multi/parts')
  t.equal(new Request({url: '/trailing/slash/??query'}).path, '/trailing/slash/')
  t.end()
})

t.test('req.protocol - trustProxy=false', (t) => {
  t.plan(3)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.protocol)
  })

  request(app, {
    url: '/',
    headers: {
      'X-Forwarded-Proto': 'https',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'http')
  })
})

t.test('req.protocol - trustProxy=true', (t) => {
  t.plan(6)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.protocol)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'http')
  })

  request(app, {
    url: '/',
    headers: {
      'X-Forwarded-Proto': 'https',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'https')
  })
})

t.test('req.protocol - https', (t) => {
  t.plan(6)

  const app = medley({
    https: {
      key: fs.readFileSync(path.join(__dirname, 'https/app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'https/app.crt')),
    },
    trustProxy: true,
  })

  app.get('/', (req, res) => {
    res.send(req.protocol)
  })

  request(app, {
    url: '/',
    rejectUnauthorized: false,
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'https')
  })

  request(app, {
    url: '/',
    rejectUnauthorized: false,
    headers: {
      'X-Forwarded-Proto': 'sftp',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'https')
  })
})

t.test('request.query - get', (t) => {
  const req = {url: '/path?search=1'}
  t.deepEqual(new Request(req).query, {search: '1'})
  t.end()
})

t.test('request.query - set', (t) => {
  const req = new Request({url: '/path?search=1'})

  req.query = 'string'
  t.equal(req.query, 'string')

  t.end()
})

t.test('request.querystring - get', (t) => {
  t.equal(new Request({url: '/'}).querystring, '')
  t.equal(new Request({url: '/no-query'}).querystring, '')
  t.equal(new Request({url: '/?'}).querystring, '')
  t.equal(new Request({url: '/path?'}).querystring, '')
  t.equal(new Request({url: '/path?search=1'}).querystring, 'search=1')
  t.equal(new Request({url: '/?qu?ery'}).querystring, 'qu?ery')
  t.equal(new Request({url: '/??query'}).querystring, '?query')
  t.equal(new Request({url: '/?query?'}).querystring, 'query?')
  t.equal(new Request({url: '/?a&b=1%23-&c='}).querystring, 'a&b=1%23-&c=')
  t.end()
})

t.test('request.search - get', (t) => {
  t.equal(new Request({url: '/'}).search, '')
  t.equal(new Request({url: '/no-query'}).search, '')
  t.equal(new Request({url: '/?'}).search, '?')
  t.equal(new Request({url: '/path?'}).search, '?')
  t.equal(new Request({url: '/path?search=1'}).search, '?search=1')
  t.equal(new Request({url: '/?qu?ery'}).search, '?qu?ery')
  t.equal(new Request({url: '/??query'}).search, '??query')
  t.equal(new Request({url: '/?query?'}).search, '?query?')
  t.equal(new Request({url: '/?a&b=1%23-&c='}).search, '?a&b=1%23-&c=')
  t.end()
})

t.test('req.scheme is an alias for req.protocol', (t) => {
  t.strictDeepEqual(
    Object.getOwnPropertyDescriptor(Request.prototype, 'scheme'),
    Object.getOwnPropertyDescriptor(Request.prototype, 'protocol')
  )
  t.end()
})

t.test('request.url - get', (t) => {
  const req = {url: '/some-url'}
  t.equal(new Request(req).url, '/some-url')
  t.end()
})
