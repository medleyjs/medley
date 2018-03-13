# Testing
Testing is one of the most important parts of developing an application. Medley is very flexible when it comes to testing and is compatible with most testing frameworks (such as [Tap](https://www.npmjs.com/package/tap), which is used in the examples below).

<a name="inject"></a>
### Testing with http injection
Medley comes with built-in support for fake http injection thanks to [`light-my-request`](https://github.com/fastify/light-my-request).

To inject a fake http request, use the `inject` method:

```js
app.inject({
  method: String,
  url: String,
  payload: Object,
  headers: Object
}, (error, response) => {
  // your tests
})
```

or in the promisified version:

```js
app
  .inject({
    method: String,
    url: String,
    payload: Object,
    headers: Object
  })
  .then(response => {
    // your tests
  })
  .catch(err => {
    // handle error
  })
```

Async await is supported as well!
```js
try {
  const res = await app.inject({ method: String, url: String, payload: Object, headers: Object })
  // your tests
} catch (err) {
  // handle error
}
```

#### Example:

**app.js**
```js
const medley = require('@medley/medley')

function buildMedley () {
  const app = medley()

  app.get('/', (request, response) => {
    response.send({ hello: 'world' })
  })
  
  return app
}

module.exports = buildMedley
```

**test.js**
```js
const tap = require('tap')
const buildMedley = require('./app')

tap.test('GET `/` route', t => {
  t.plan(4)
  
  const app = buildMedley()
  
  // At the end of your tests it is highly recommended to call `.close()`
  // to ensure that all connections to external services get closed.
  t.tearDown(() => app.close())

  app.inject({
    method: 'GET',
    url: '/'
  }, (err, response) => {
    t.error(err)
    t.strictEqual(response.statusCode, 200)
    t.strictEqual(response.headers['content-type'], 'application/json')
    t.deepEqual(JSON.parse(response.payload), { hello: 'world' })
  })
})
```

### Testing with a running server
Medley can also be tested after starting the server with `app.listen()` or after initializing routes and plugins with `app.ready()`.

#### Example:

Uses **app.js** from the previous example.

**test-listen.js** (testing with [`Request`](https://www.npmjs.com/package/request))
```js
const tap = require('tap')
const request = require('request')
const buildMedley = require('./app')

tap.test('GET `/` route', t => {
  t.plan(5)
  
  const app = buildMedley()
  
  t.tearDown(() => app.close())
  
  app.listen(0, (err) => {
    t.error(err)
    
    request({
      method: 'GET',
      url: 'http://localhost:' + app.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-type'], 'application/json')
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})
```

**test-ready.js** (testing with [`SuperTest`](https://www.npmjs.com/package/supertest))
```js
const tap = require('tap')
const supertest = require('supertest')
const buildMedley = require('./app')

tap.test('GET `/` route', async (t) => {
  const app = buildMedley()

  t.tearDown(() => app.close())
  
  await app.ready()
  
  const response = await supertest(app.server)
    .get('/')
    .expect(200)
    .expect('content-type', 'application/json')
  t.deepEqual(response.body, { hello: 'world' })
})
```
