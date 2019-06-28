'use strict'

const t = require('tap')
const http = require('http')
const medley = require('..')

t.plan(5)

const app = medley()

t.equal(app.server, null, 'app.server starts out as null')

app.onLoad((done) => {
  t.ok(app.server, 'app.server exists in onLoad callbacks')
  done()
})

app.listen((err) => {
  app.close()
  t.error(err)
  t.ok(app.server, 'app.server exists after app.listen is called()')
})

const server = http.createServer()
const appWithServer = medley({server})

t.equal(appWithServer.server, server, 'app.server is the value passed to the server option')
