'use strict'

const t = require('tap')
const fs = require('fs')
const request = require('../utils/request')
const medley = require('../..')

t.test('shorthand - head', (t) => {
  t.plan(10)

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

  request(app, {
    method: 'HEAD',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '4')
    t.equal(res.body, '')
  })

  request(app, {
    method: 'HEAD',
    url: '/missing-schema',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '4')
    t.equal(res.body, '')
  })
})

t.test('head request without sending a body', (t) => {
  t.plan(9)

  const app = medley()

  app.head('/', (req, res) => {
    res.send()
  })

  app.head('/length-set', (req, res) => {
    res.setHeader('content-length', '4').send()
  })

  request(app, {
    method: 'HEAD',
    url: '/',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('content-length'), false)
    t.equal(res.body, '')
  })

  request(app, {
    method: 'HEAD',
    url: '/length-set',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers.hasOwnProperty('content-length'), true)
    t.equal(res.headers['content-length'], '4')
    t.equal(res.body, '')
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

  request(app, {
    method: 'HEAD',
    url: '/string',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '5')
    t.equal(res.body, '')
  })

  request(app, {
    method: 'HEAD',
    url: '/buffer',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], '5')
    t.equal(res.body, '')
  })

  request(app, {
    method: 'HEAD',
    url: '/stream',
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-length'], undefined)
    t.equal(res.body, '')
  })
})
