'use strict'

const {test} = require('tap')
const request = require('./utils/request')
const medley = require('..')

const noop = () => {}

test('Optional params', (t) => {
  t.plan(31)

  const app = medley()

  app.get('/user/:id?', (req, res) => {
    t.ok(req.params.hasOwnProperty('id'), 'req.params should always have the optional parameter property')
    res.send(req.params)
  })

  app.get('/events/:type?', (req, res) => {
    t.ok(req.params.hasOwnProperty('type'), 'req.params should always have the optional parameter property')
    res.send('Events: ' + JSON.stringify(req.params))
  })
  app.get('/events/:type/subtypes', (req, res) => {
    res.send('Events with subtypes: ' + JSON.stringify(req.params))
  })

  request(app, '/user', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{}')
  })
  request(app, '/user/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{}')
  })
  request(app, '/user/123', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"id":"123"}')
  })

  request(app, '/events', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'Events: {}')
  })
  request(app, '/events/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'Events: {}')
  })
  request(app, '/events/change', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'Events: {"type":"change"}')
  })

  request(app, '/events/change/subtypes', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'Events with subtypes: {"type":"change"}')
  })

  // Does not match routes
  request(app, '/user/123/comments', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
  })
  request(app, '/events/change/not-subtype', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
  })
})

test('Throws if an optional param is declared at the URL root', (t) => {
  const app = medley()

  t.throws(
    () => app.get('/:param?', noop),
    /Cannot have an optional parameter at the URL root/
  )
  t.end()
})

test('Throws if routes with an optional parameter conflict with static routes', (t) => {
  const app = medley()
    .get('/user/:id?', noop)
    .get('/events/:type?', noop)
    .get('/events/:type/subtypes', noop)
    .get('/static', noop)
    .get('/r/', noop)

  t.throws(
    () => app.get('/user', noop),
    new Error('Cannot create route "GET /user" because it already exists')
  )
  t.throws(
    () => app.get('/user/', noop),
    new Error('Cannot create route "GET /user/" because it already exists')
  )
  t.throws(
    () => app.get('/user/:id', noop),
    new Error('Cannot create route "GET /user/:id" because it already exists')
  )
  t.throws(
    () => app.get('/events', noop),
    new Error('Cannot create route "GET /events" because it already exists')
  )
  t.throws(
    () => app.get('/events/', noop),
    new Error('Cannot create route "GET /events/" because it already exists')
  )
  t.throws(
    () => app.get('/static/:file?', noop),
    new Error('Cannot create route "GET /static" because it already exists')
  )
  t.throws(
    () => app.get('/r/:roomID?', noop),
    new Error('Cannot create route "GET /r/" because it already exists')
  )
  t.end()
})


test('Optional wildcard', (t) => {
  t.plan(24)

  const app = medley()

  app.get('/static/*?', (req, res) => {
    t.ok(req.params.hasOwnProperty('*'), 'req.params should always have the optional wildcard property')
    res.send(req.params)
  })

  request(app, '/static', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{}')
  })
  request(app, '/static/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"*":""}')
  })
  request(app, '/static/1', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"*":"1"}')
  })
  request(app, '/static/123', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"*":"123"}')
  })
  request(app, '/static/js/', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"*":"js/"}')
  })
  request(app, '/static/js/common.js', (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.body, '{"*":"js/common.js"}')
  })
})

test('Throws if an optional wildcard is declared at the URL root', (t) => {
  const app = medley()

  t.throws(
    () => app.get('/*?', noop),
    /Cannot have an optional wildcard at the URL root/
  )
  t.end()
})

test('Throws if routes with an optional wildcard conflict with static routes', (t) => {
  const app = medley()
    .get('/r/*?', noop)
    .get('/static', noop)

  t.throws(
    () => app.get('/r', noop),
    new Error('Cannot create route "GET /r" because it already exists')
  )
  t.throws(
    () => app.get('/static/*?', noop),
    new Error('Cannot create route "GET /static" because it already exists')
  )
  t.end()
})
