'use strict'

const t = require('tap')
const medley = require('..')

t.test('not-found route beforeHandler', (t) => {
  t.plan(2)
  const app = medley()

  app.setNotFoundHandler({
    beforeHandler: (req, res, next) => {
      req.beforeHandler = true
      next()
    },
  }, (req, res) => {
    t.equal(req.beforeHandler, true)
    res.send()
  })

  app.inject('/', (err) => {
    t.error(err)
  })
})

t.test('not-found route beforeHandler should be called after preHandler hook', (t) => {
  t.plan(2)
  const app = medley()

  app.addHook('preHandler', (req, res, next) => {
    req.sendVal = 'a'
    next()
  })

  app.setNotFoundHandler({
    beforeHandler: (req, res, next) => {
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

t.test('not-found route beforeHandler could accept an array of functions', (t) => {
  t.plan(2)
  const app = medley()

  app.setNotFoundHandler({
    beforeHandler: [
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
