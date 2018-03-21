# Testing

Testing is one of the most important parts of developing an application. Medley
is very flexible when it comes to testing and is compatible with most testing
frameworks (such as [Tap](https://www.npmjs.com/package/tap), which is used
in the examples below).

<a id="inject"></a>
### Testing with http injection

Medley comes with built-in support for fake http injection via to
[`light-my-request`](https://github.com/fastify/light-my-request).

To inject a fake http request, use the `inject` method:

```js
app.inject({
  method: String,
  url: String,
  payload: Object,
  headers: Object
}, (error, response) => {
  // Tests
})
```

Or using a promise instead of a callback:

```js
app
  .inject({
    method: String,
    url: String,
    payload: Object,
    headers: Object
  })
  .then(response => {
    // Tests
  })
  .catch(err => {
    // Handle error
  })
```

Async-await is supported as well:

```js
try {
  const response = await app.inject({
    method: String,
    url: String,
    payload: Object,
    headers: Object
  })
  // Tests
} catch (err) {
  // Handle error
}
```

There is also a shorthand signature to make a GET request:

```js
app.inject('/url', (error, response) => {
  // Tests
})
```

#### Example:

**app.js**
```js
const medley = require('@medley/medley')

function buildApp () {
  const app = medley()

  app.get('/', (req, res) => {
    res.send({ hello: 'world' })
  })
  
  return app
}

module.exports = buildApp
```

**test.js**
```js
const tap = require('tap')
const buildApp = require('./app')

tap.test('GET `/` route', t => {
  t.plan(4)
  
  const app = buildApp()
  
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

Medley can also be tested after starting the server with `app.listen()` or
after initializing the app with `app.load()`.

#### Example:

Uses **app.js** from the previous example.

**test-listen.js** (testing with [`Request`](https://www.npmjs.com/package/request))
```js
const tap = require('tap')
const request = require('request')
const buildApp = require('./app')

tap.test('GET `/` route', t => {
  t.plan(5)
  
  const app = buildApp()
  
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

**test-load.js** (testing with [`SuperTest`](https://www.npmjs.com/package/supertest))
```js
const tap = require('tap')
const supertest = require('supertest')
const buildApp = require('./app')

tap.test('GET `/` route', async (t) => {
  const app = buildApp()

  t.tearDown(() => app.close())
  
  await app.load()
  
  const response = await supertest(app.server)
    .get('/')
    .expect(200)
    .expect('content-type', 'application/json')
  t.deepEqual(response.body, { hello: 'world' })
})
```
