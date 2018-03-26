# Decorators

Medley allows for its functionality to be extended through the use of *decorators*.
Decorators are just extra properties that are added to the `app`, `req`, and `res`
objects. The following methods can be used to decorate each object:

+ [`app.decorate(name, value)`](#decorate)
+ [`app.decorateRequest(name, value)`](#decorate-request)
+ [`app.decorateResponse(name, value)`](#decorate-response)

Decorators are not *overwritable*. If a decorator function is called with the `name` of an existing
decorator (including the name of any property native to Medley) and error will be thrown.


## Usage

<a id="decorate"></a>
### `app.decorate(name, value)`

Adds a new property to the `app`.

```js
app.decorate('doSomething', function doSomething() {
  // Does something
});
```

The `value` can be anything:

```js
app.decorate('config', {
  host: 'ww.example.com',
  port: 3000
});
```

After adding a decorator, the property can be accessed on the `app` object:

```js
app.doSomething();
app.config.port; // 3000
```

#### Encapsulation

App decorators are encapsulated to the scope in which they are defined and they are
inherited by sub-apps. This means that any decorator defined on the root `app`
will be available everywhere and decorators defined on a sub-app will only
be available to that sub-app and its own sub-apps.

```js
app.decorate('top', true);

app.use((subApp1) => {
  subApp1.decorate('one', 1);

  console.log(subApp1.top); // true
  console.log(subApp1.one); // 1
  console.log(subApp1.two); // undefined
});

app.use((subApp2) => {
  subApp2.decorate('two', 2);

  console.log(subApp2.top); // true
  console.log(subApp2.one); // undefined
  console.log(subApp2.two); // 2
});
```

<a id="decorate-request"></a>
### `app.decorateRequest(name, value)`

Adds a new property to Medley's [`Request`](Request.md) object. This property
will be available on the `req` object in handlers:

```js
app.decorateRequest('logHello', function logHello() {
  console.log('Hello', this.url);
  // `this` refers to the Request instance
});

app.get('/path', (req, res) => {
  req.logHello(); // Logs: 'Hello /path'
});
```

Request decorators are not encapsulated and will be available in every route.

<a id="decorate-response"></a>
### `app.decorateResponse(name, value)`

Adds a new property to Medley's [`Response`](Response.md) object. This property
will be available on the `res` object in handlers:

```js
app.decorateResponse('logGoodbye', function logGoodbye() {
  console.log('Goodbye', this.request.url);
  // `this` refers to the Response instance
});

app.get('/path', (req, res) => {
  res.logGoodbye(); // Logs: 'Goodbye /path'
});
```

Response decorators are not encapsulated and will be available in every route.
