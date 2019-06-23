'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

test('preHandler', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', {
    preHandler: (req, res, done) => {
      req.sendVal = true
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(JSON.parse(res.body), true)
  })
})

test('preHandler should be called after global onRequest hook', (t) => {
  t.plan(2)
  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    req.sendVal = 'a'
    next()
  })

  app.get('/', {
    preHandler: (req, res, done) => {
      req.sendVal += 'b'
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'ab')
  })
})

test('preHandler should be unique per route', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', {
    preHandler: (req, res, done) => {
      req.sendVal = 'hello'
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.get('/no-before-handler', (req, res) => {
    res.send(req.sendVal)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'hello')
  })

  request(app, '/no-before-handler', (err, res) => {
    t.error(err)
    t.equal(res.body, '')
  })
})

test('preHandler should handle errors', (t) => {
  t.plan(3)
  const app = medley()

  app.get('/', {
    preHandler: (req, res, done) => {
      done(new Error('kaboom'))
    },
  }, (req, res) => {
    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.body)
    t.equal(res.statusCode, 500)
    t.strictDeepEqual(payload, {
      message: 'kaboom',
      error: 'Internal Server Error',
      statusCode: 500,
    })
  })
})

test('preHandler should handle errors with custom status code', (t) => {
  t.plan(3)
  const app = medley()

  app.get('/', {
    preHandler: (req, res, done) => {
      done(Object.assign(new Error('go away'), {status: 401}))
    },
  }, (req, res) => {
    res.send()
  })

  request(app, '/', (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.body)
    t.equal(res.statusCode, 401)
    t.deepEqual(payload, {
      message: 'go away',
      error: 'Unauthorized',
      statusCode: 401,
    })
  })
})

test('preHandler could accept an array of functions', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', {
    preHandler: [
      (req, res, done) => {
        req.sendVal = 'a'
        done()
      },
      (req, res, done) => {
        req.sendVal += 'b'
        done()
      },
    ],
  }, (req, res) => {
    res.send(req.sendVal)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'ab')
  })
})

test('preHandler does not interfere with onRequest hooks', (t) => {
  t.plan(4)
  const app = medley()

  app.addHook('onRequest', (req, res, next) => {
    req.sendVal = 'a'
    next()
  })

  app.get('/', {
    preHandler: (req, res, done) => {
      req.sendVal += 'b'
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.get('/no', (req, res) => {
    res.send(req.sendVal)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'ab')
  })

  request(app, '/no', (err, res) => {
    t.error(err)
    t.equal(res.body, 'a')
  })
})

test('preHandlers can be passed as the second parameter to route shorthand methods', (t) => {
  t.plan(4)

  const app = medley()

  app.get('/', [
    (req, res, done) => {
      req.sendVal = 'first'
      done()
    },
  ], (req, res) => {
    res.send(req.sendVal)
  })

  app.get('/multi', [
    (req, res, done) => {
      req.sendVal = 'a'
      done()
    },
    (req, res, done) => {
      req.sendVal += 'b'
      done()
    },
  ], (req, res) => {
    res.send(req.sendVal)
  })

  request(app, '/', (err, res) => {
    t.error(err)
    t.equal(res.body, 'first')
  })

  request(app, '/multi', (err, res) => {
    t.error(err)
    t.equal(res.body, 'ab')
  })
})
