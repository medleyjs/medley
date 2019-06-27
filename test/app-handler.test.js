'use strict'

const t = require('tap')
const medley = require('..')

t.plan(5)

const app = medley()
const mockReq = {method: 'GET', url: '/'}
const mockRes = {}

app.addHook('onRequest', (req, res) => {
  t.equal(req.stream, mockReq)
  t.equal(res.stream, mockRes)
})

t.equal(app.handler, null, 'app.handler is null before app is loaded')

app.load((err) => {
  t.error(err)
  t.type(app.handler, 'function')

  app.handler(mockReq, mockRes)
})
