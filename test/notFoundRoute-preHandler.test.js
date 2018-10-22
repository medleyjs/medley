'use strict'

const t = require('tap')
const medley = require('..')

t.test('not-found route preHandler', (t) => {
  t.plan(2)
  const app = medley()

  app.setNotFoundHandler({
    preHandler: (req, res, next) => {
      req.preHandler = true
      next()
    },
  }, (req, res) => {
    t.equal(req.preHandler, true)
    res.send()
  })

  app.inject('/', (err) => {
    t.error(err)
  })
})

t.test('not-found route preHandler should be called after global preHandler hook', (t) => {
  t.plan(2)
  const app = medley()

  app.addHook('preHandler', (req, res, next) => {
    req.sendVal = 'a'
    next()
  })

  app.setNotFoundHandler({
    preHandler: (req, res, next) => {
      req.sendVal += 'b'
      next()
    },
  }, (req, res) => {
    res.send(req.sendVal)
  })

  app.inject('/', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'ab')
  })
})

t.test('not-found route preHandler should accept an array of functions', (t) => {
  t.plan(2)
  const app = medley()

  app.setNotFoundHandler({
    preHandler: [
      (req, res, next) => {
        req.sendVal = 'a'
        next()
      },
      (req, res, next) => {
        req.sendVal += 'b'
        next()
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
