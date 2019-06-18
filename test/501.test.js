'use strict'

const t = require('tap')
const h2url = require('h2url')
const medley = require('..')

t.test('501', (t) => {
  t.plan(5)

  const app = medley({http2: true})

  app.all('/', (req, res) => {
    res.send({hello: 'world'})
  })

  app.listen(0, 'localhost', async (err) => {
    app.server.unref()
    t.error(err)

    const res = await h2url.concat({
      method: 'TROLL',
      url: 'http://localhost:' + app.server.address().port,
    })
    t.equal(res.headers[':status'], 501)
    t.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
    t.equal(res.headers['content-length'], '33')
    t.equal(res.body, 'Unsupported request method: TROLL')
  })
})
