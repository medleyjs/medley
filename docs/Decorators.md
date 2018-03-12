# Decorators

The API allows you to add new properties to the Medley `app` instance. A value is not restricted to a function and could also be an object or a string, for example.

<a name="usage"></a>
### Usage
<a name="decorate"></a>
**decorate**
Just call the `decorate` API and pass the name of the new property and its value.
```js
app.decorate('utility', () => {
  // something very useful
})
```

As said above, you can also decorate the app with non-function values:
```js
app.decorate('conf', {
  db: 'some.db',
  port: 3000
})
```

Once you decorate the app, you can access the value by using the name you passed as a parameter:
```js
app.utility()

console.log(app.conf.db)
```

Decorators are not *overwritable*. If you try to declare a decorator that was previously declared *(in other words, use the same name)*, `decorate` will throw an exception.

<a name="decorate-response"></a>
**decorateResponse**
As the name suggests, this API is needed if you want to add new methods to the `Response` core object. Just call the `decorateResponse` API and pass the name of the new property and its value:
```js
app.decorateResponse('utility', function () {
  // something very useful
})
```

<a name="decorate-request"></a>
**decorateRequest**
As above, this API is needed if you want to add new methods to the `Request` core object. Just call the `decorateRequest` API and pass the name of the new property and its value:
```js
app.decorateRequest('utility', function () {
  // something very useful
})
```

<a name="sync-async"></a>
#### Sync and Async
`decorate` is a *synchronous* API. If you need to add a decorator that has an *asynchronous* bootstrap, Medley could boot up before your decorator is ready. To avoid this issue, you must use the `register` API in combination with `fastify-plugin`. To learn more, check out the [Plugins](Plugins.md) documentation as well.
