'use strict'

const t = require('tap')
const fs = require('fs')
const sget = require('simple-get').concat
const medley = require('../..')

t.test('shorthand - head', (t) => {
  t.plan(11)

  const app = medley()

  const responseSchema = {
    200: {
      type: 'boolean',
    },
  }

  app.head('/', {responseSchema}, (req, res) => {
    t.pass('handler called')
    res.send(true)
  })

  app.head('/missing-schema', (req, res) => {
    t.pass('handler called')
    res.send(true)
  })

  app.listen(0, (err) => {
    t.error(err)
    app.server.unref()

    sget({
      method: 'HEAD',
      url: `http://localhost:${app.server.address().port}`,
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(response.headers['content-length'], '4')
      t.equal(body.toString(), '')
    })

    sget({
      method: 'HEAD',
      url: `http://localhost:${app.server.address().port}/missing-schema`,
    }, (err, response, body) => {
      t.error(err)
      t.equal(response.statusCode, 200)
      t.equal(response.headers['content-length'], '4')
      t.equal(body.toString(), '')
    })
  })
})

t.test('head request without sending a body', (t) => {
  t.plan(9)

  const app = medley()

  app.head('/', (req, res) => {
    res.send()
  })

  app.head('/length-set', (req, res) => {
    res.set('content-length', '4').send()
  })

  app.inject({
    method: 'HEAD',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('content-length'), false)
    t.equal(res.payload, '')
  })

  app.inject({
    method: 'HEAD',
    url: '/length-set',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('content-length'), true)
    t.equal(res.headers['content-length'], '4')
    t.equal(res.payload, '')
  })
})

t.test('GET method is called if a HEAD is not defined', (t) => {
  t.plan(15)

  const app = medley()

  app.get('/string', (req, res) => {
    t.pass('GET string handler called')
    res.send('hello')
  })

  app.get('/buffer', (req, res) => {
    t.pass('GET buffer handler called')
    res.send(Buffer.from('hello'))
  })

  app.get('/stream', (req, res) => {
    t.pass('GET stream handler called')
    res.send(fs.createReadStream(__filename))
  })

  app.inject({
    method: 'HEAD',
    url: '/string',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '5')
    t.equal(res.payload, '')
  })

  app.inject({
    method: 'HEAD',
    url: '/buffer',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '5')
    t.equal(res.payload, '')
  })

  app.inject({
    method: 'HEAD',
    url: '/stream',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], undefined)
    t.equal(res.payload, '')
  })
})
