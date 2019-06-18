'use strict'

const t = require('tap')
const request = require('../utils/request')
const fs = require('fs')
const path = require('path')
const medley = require('../..')

t.test('https get request', (t) => {
  t.plan(4)

  const app = medley({
    https: {
      key: fs.readFileSync(path.join(__dirname, 'app.key')),
      cert: fs.readFileSync(path.join(__dirname, 'app.crt')),
    },
  })

  app.get('/', function(req, res) {
    res.send({hello: 'world'})
  })

  request(app, '/', {rejectUnauthorized: false}, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '' + res.body.length)
    t.strictDeepEqual(JSON.parse(res.body), {hello: 'world'})
  })
})
