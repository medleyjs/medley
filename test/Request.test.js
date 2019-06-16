'use strict'

const t = require('tap')
const fs = require('fs')
const medley = require('..')
const path = require('path')
const sget = require('simple-get').concat

const Request = require('../lib/Request').buildRequest(false)

t.test('Request object', (t) => {
  t.plan(5)
  const request = new Request('reqStream', 'headers', 'params')
  t.type(request, Request)
  t.equal(request.stream, 'reqStream')
  t.equal(request.headers, 'headers')
  t.equal(request.params, 'params')
  t.equal(request.body, undefined)
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

  app.inject('/', (err, res) => {
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

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 500)
    t.equal(JSON.parse(res.payload).message, 'Manual error')
  })
})

t.test('req.host - trustProxy=false', (t) => {
  t.plan(6)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.host)
  })

  app.inject({
    url: '/',
    headers: {
      Host: 'justhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'justhost.com')
  })

  app.inject({
    url: '/',
    headers: {
      Host: 'justhost.com',
      'X-Forwarded-Host': 'forwardedhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'justhost.com')
  })
})

t.test('req.host - trustProxy=true', (t) => {
  t.plan(6)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.host)
  })

  app.inject({
    url: '/',
    headers: {
      Host: 'justhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'justhost.com')
  })

  app.inject({
    url: '/',
    headers: {
      Host: 'justhost.com',
      'X-Forwarded-Host': 'forwardedhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'forwardedhost.com')
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

  app.inject({
    url: '/',
    headers: {
      Host: 'host.com',
      'X-Forwarded-Host': 'xhost.com',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'host.com')
  })

  app.inject({
    url: '/',
    headers: {
      Host: '[::1]',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, '[::1]')
  })

  app.inject({
    url: '/',
    headers: {
      Host: 'host.com:8080',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'host.com')
  })

  app.inject({
    url: '/',
    headers: {
      Host: '[::1]:8080',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, '[::1]')
  })

  app.inject({
    url: '/',
    headers: {
      Host: '[2001:db8:85a3::8a2e:370:7334]',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, '[2001:db8:85a3::8a2e:370:7334]')
  })
})

t.test('req.hostname - trustProxy=true', (t) => {
  t.plan(3)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.hostname)
  })

  app.inject({
    url: '/',
    headers: {
      Host: 'host.com:80',
    },
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'host.com')
  })
})

t.test('req.href - trustProxy=false', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/*', (req, res) => {
    res.send(req.href)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}/status/user?name=medley`

    sget({
      url,
      headers: {
        'X-Forwarded-Host': 'xhost.com',
        'X-Forwarded-Proto': 'https',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), url)
    })
  })
})

t.test('req.href - trustProxy=true', (t) => {
  t.plan(7)

  const app = medley({trustProxy: true})

  app.get('/*', (req, res) => {
    res.send(req.href)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}/status/user/?name=medley`

    sget(url, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), url)
    })

    sget({
      url,
      headers: {
        'X-Forwarded-Host': 'xhost.com',
        'X-Forwarded-Proto': 'https',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'https://xhost.com/status/user/?name=medley')
    })
  })
})

t.test('request.method - get', (t) => {
  const req = {method: 'GET'}
  t.equal(new Request(req).method, 'GET')
  t.end()
})

t.test('req.origin - trustProxy=false', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.origin)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      url: `http://localhost:${app.server.address().port}/`,
      headers: {
        'X-Forwarded-Host': 'xhost.com',
        'X-Forwarded-Proto': 'https',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), `http://localhost:${app.server.address().port}`)
    })
  })
})

t.test('req.origin - trustProxy=true', (t) => {
  t.plan(7)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.origin)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}/`

    sget(url, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), url.slice(0, -1))
    })

    sget({
      url,
      headers: {
        'X-Forwarded-Host': 'xhost.com',
        'X-Forwarded-Proto': 'https',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'https://xhost.com')
    })
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
  t.plan(4)

  const app = medley()

  app.get('/', (req, res) => {
    res.send(req.protocol)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      url: `http://localhost:${app.server.address().port}`,
      headers: {
        'X-Forwarded-Proto': 'https',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'http')
    })
  })
})

t.test('req.protocol - trustProxy=true', (t) => {
  t.plan(7)

  const app = medley({trustProxy: true})

  app.get('/', (req, res) => {
    res.send(req.protocol)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    const url = `http://localhost:${app.server.address().port}`

    sget(url, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'http')
    })

    sget({
      url,
      headers: {
        'X-Forwarded-Proto': 'https',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'https')
    })
  })
})

t.test('req.protocol - https', (t) => {
  t.plan(7)

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

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    const url = `https://localhost:${app.server.address().port}`

    sget({
      url,
      rejectUnauthorized: false,
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'https')
    })

    sget({
      url,
      rejectUnauthorized: false,
      headers: {
        'X-Forwarded-Proto': 'sftp',
      },
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(body.toString(), 'https')
    })
  })
})

t.test('request.query - get', (t) => {
  const req = {url: '/path?search=1'}
  t.deepEqual(new Request(req).query, {search: '1'})
  t.end()
})

t.test('request.query - set', (t) => {
  const req = {url: '/path?search=1'}
  const request = new Request(req)

  request.query = 'string'
  t.equal(request.query, 'string')

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
