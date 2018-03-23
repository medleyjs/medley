'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('beforeHandler', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', {
    beforeHandler: (req, res, done) => {
      req.sendVal = true
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(JSON.parse(res.payload), true)
  })
})

test('beforeHandler should be called after preHandler hook', (t) => {
  t.plan(2)
  const app = medley()

  app.addHook('preHandler', (req, res, next) => {
    req.sendVal = 'a'
    next()
  })

  app.get('/', {
    beforeHandler: (req, res, done) => {
      req.sendVal += 'b'
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'ab')
  })
})

test('beforeHandler should be unique per route', (t) => {
  t.plan(4)
  const app = medley()

  app.get('/', {
    beforeHandler: (req, res, done) => {
      req.sendVal = 'hello'
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.get('/no-before-handler', (req, res) => {
    res.send(req.sendVal)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'hello')
  })

  app.inject('/no-before-handler', (err, res) => {
    t.error(err)
    t.equal(res.payload, '')
  })
})

test('beforeHandler should handle errors', (t) => {
  t.plan(3)
  const app = medley()

  app.get('/', {
    beforeHandler: (req, res, done) => {
      done(new Error('kaboom'))
    },
  }, (req, res) => {
    res.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.equal(res.statusCode, 500)
    t.strictDeepEqual(payload, {
      message: 'kaboom',
      error: 'Internal Server Error',
      statusCode: 500,
    })
  })
})

test('beforeHandler should handle errors with custom status code', (t) => {
  t.plan(3)
  const app = medley()

  app.get('/', {
    beforeHandler: (req, res, done) => {
      done(Object.assign(new Error('go away'), {status: 401}))
    },
  }, (req, res) => {
    res.send()
  })

  app.inject('/', (err, res) => {
    t.error(err)
    var payload = JSON.parse(res.payload)
    t.equal(res.statusCode, 401)
    t.deepEqual(payload, {
      message: 'go away',
      error: 'Unauthorized',
      statusCode: 401,
    })
  })
})

test('beforeHandler could accept an array of functions', (t) => {
  t.plan(2)
  const app = medley()

  app.get('/', {
    beforeHandler: [
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

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'ab')
  })
})

test('beforeHandler does not interfere with preHandler', (t) => {
  t.plan(4)
  const app = medley()

  app.addHook('preHandler', (req, res, next) => {
    req.sendVal = 'a'
    next()
  })

  app.get('/', {
    beforeHandler: (req, res, done) => {
      req.sendVal += 'b'
      done()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.get('/no', (req, res) => {
    res.send(req.sendVal)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'ab')
  })

  app.inject('/no', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'a')
  })
})
