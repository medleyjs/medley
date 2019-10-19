# Extensions

Medley allows for its functionality to be extended by adding properties to the
`app`, `req`, and `res` objects. The following methods can be used to extend
each object, respectively:

+ [`app.extend(name, value)`](#extend)
+ [`app.extendRequest(name, value)`](#extend-request)
+ [`app.extendResponse(name, value)`](#extend-response)

Properties are not *overwritable*. If an extension function is called with the `name` of an existing
property (including the name of any property native to Medley) and error will be thrown.


## Usage

<a id="extend"></a>
### `app.extend(name, value)`

Adds a new property to the `app`.

```js
app.extend('config', {
  host: 'ww.example.com',
  port: 3000
});
```

The `value` can be anything:

```js
app.extend('addExpressMiddleware', function(middleware) {
  this.addHook('onRequest', (req, res) => {
    middleware(req.stream, res.stream);
  });
});
```

After adding an extension, the property can be accessed on the `app` object:

```js
console.log(app.config); // { host: 'ww.example.com', port: 3000 }

app.addExpressMiddleware(require('compression'));
```

#### Encapsulation

App extensions are encapsulated to the scope in which they are defined and they are
inherited by sub-apps. This means that any property defined on the root `app`
will be available everywhere and extensions defined on a sub-app will only
be available to that sub-app and its own sub-apps.

```js
app.extend('top', true);

console.log(app.top); // true

{
  const subApp1 = app.createSubApp();

  subApp1.extend('one', 1);

  console.log(subApp1.top); // true
  console.log(subApp1.one); // 1
  console.log(subApp1.two); // undefined
}

{
  const subApp2 = app.createSubApp();

  subApp2.extend('two', 2);

  console.log(subApp2.top); // true
  console.log(subApp2.one); // undefined
  console.log(subApp2.two); // 2
}

console.log(app.one); // undefined
console.log(app.two); // undefined
```

<a id="extend-request"></a>
### `app.extendRequest(name, value)`

Adds a new property to Medley's [`Request`](Request.md) object. This property
will be available on the `req` object in hooks and route handlers:

```js
app.extendRequest('logHello', function logHello() {
  console.log('Hello', this.url); // `this` is the `req` object
});

app.get('/user', (req, res) => {
  req.logHello(); // Logs: 'Hello /user'
});
```

Request extensions are not encapsulated and will be available in every route.

<a id="extend-response"></a>
### `app.extendResponse(name, value)`

Adds a new property to Medley's [`Response`](Response.md) object. This property
will be available on the `res` object in hooks and route handlers:

```js
app.extendResponse('logGoodbye', function logGoodbye() {
  console.log('Goodbye', this.request.url); // `this` is the `res` object
});

app.get('/user', (req, res) => {
  res.logGoodbye(); // Logs: 'Goodbye /user'
});
```

Response extensions are not encapsulated and will be available in every route.
