'use strict'

const t = require('tap')
const http = require('http')
const request = require('./utils/request')
const medley = require('..')

t.plan(5)

const app = medley({
  server: http.createServer((req) => {
    t.pass('custom server is used')
    t.equal(req.url, '/')
  }),
})

app.get('/', (req, res) => {
  res.send('Hello')
})

request(app, '/', (err, res) => {
  t.error(err)
  t.equal(res.statusCode, 200)
  t.equal(res.body, 'Hello')
})
