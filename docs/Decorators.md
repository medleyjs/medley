# Decorators

Medley allows for its functionality to be extended through the use of *decorators*.
Decorators are just extra properties that are added to the `app`, `req`, and `res`
objects. The following methods can be used to decorate each object:

+ [`app.decorate(name, value)`](#decorate)
+ [`app.decorateRequeste(name, value)`](#decorate-request)
+ [`app.decorateResponse(name, value)`](#decorate-response)

Decorators follow Medley's sub-app encapsulation model. See the
[Decorators Encapsulation](#encapsulation) section to learn how
decorators work with encapsulation.


## Usage

<a id="decorate"></a>
### `app.decorate(name, value)`

Adds a new property to the `app`.

```js
app.decorate('doSomething', function doSomething() {
  // Does something
})
```

The `value` can be anything:

```js
app.decorate('config', {
  host: 'ww.example.com',
  port: 3000
})
```

After adding a decorator, the property is immediately accessible on the `app`:

```js
app.doSomething()
app.config.port // 3000
```

Decorators are not *overwritable*. If you try to declare a decorator that was
previously declared *(in other words, uses the same name)*, `decorate` will
throw an error.

<a id="decorate-request"></a>
### `app.decorateRequest(name, value)`

Adds a new property to Medley's [`Request`](Request.md) object. This property
will be available on the `req` object in handlers:

```js
app.decorateRequest('logHello', function logHello() {
  console.log('Hello')
})

app.get('/', (req, res) => {
  req.logHello()  
})
```

<a id="decorate-response"></a>
### `app.decorateResponse(name, value)`

Adds a new property to Medley's [`Response`](Response.md) object. This property
will be available on the `res` object in handlers:

```js
app.decorateResponse('logGoodbye', function logGoodbye() {
  console.log('Goodbye')
})

app.get('/', (req, res) => {
  res.logGoodbye()  
})
```

<a id="encapsulation"></a>
## Decorators Encapsulation

Decorators are encapsulated to the scope in which they are defined and they are
inherited by sub-apps. This means that any decorator defined on the root `app`
will be available everywhere and decorators defined on a sub-app will only
be available to that sub-app and its own sub-apps.

```js
app.decorate('config', {
  host: 'example.com',
  port: 3000,
})

app.decorateRequest('top', true)

app.use((subApp1) => {
  console.log(subApp1.config) // { host: 'example.com', port: 3000 }
  
  subApp1.decorateRequest('one', 1)

  subApp1.get('/route-1', (req, res) => {
    console.log(req.top) // true
    console.log(req.one) // 1
    console.log(req.two) // undefined
    res.send()
  })
})

app.use((subApp2) => {
  console.log(subApp2.config) // { host: 'example.com', port: 3000 }
  
  subApp2.decorateRequest('two', 2)

  subApp2.get('/route-2', (req, res) => {
    console.log(req.top) // true
    console.log(req.one) // undefined
    console.log(req.two) // 2
    res.send()
  })
})
```
