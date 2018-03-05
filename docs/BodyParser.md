# Body Parser

Medley comes with a body parser for the `application/json` Content-Type. To parse different content types, `app.addBodyParser()` can be used to add more body parsers. The parsed request body is added to the [Medley request](Request.md) object as `request.body`.

As with the other APIs, `addBodyParser` is encapsulated in the scope in which it is declared. This means that if a parser is declared in the root scope, it will be available everywhere, whereas if it is declared inside a sub app, it will be available only in that scope and its children.

If needed, the default JSON parser can be overridden by adding a parser with the Content-Type `'application/json'`.

## `app.addBodyParser()`

#### Streaming Parsing

```js
app.addBodyParser(contentType, parser(req, done))
```

Example:

```js
app.addBodyParser('application/jsoff', (req, done) => {
  jsoffParser(req, function (err, body) {
    done(err, body)
  })
})

// Promises (and async-await) are also supported
app.addBodyParser('application/jsoff', async (req) => {
  const body = await jsoffParser(req)
  return body
})
```

#### Collected-Body Parsing

```js
app.addBodyParser(contentType, options, parser(req, body, done))
```

By using the `parseAs` option, the request body will be collected and then passed to the `parser` callback as the second argument.

##### Options

+ `parseAs` (string): Either `'buffer'` or `'string'` to designate how the incoming data should be collected. Default: `undefined`.
+ `bodyLimit` (number): The maximum payload size, in bytes, that the custom parser will accept. Defaults to the global body limit passed to the [`Medley factory function`](Factory.md#bodylimit). If the limit is exceeded the `parser` function will not be invoked.

Example:

```js
app.addBodyParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    var json = JSON.parse(body)
    done(null, json)
  } catch (err) {
    err.statusCode = 400
    done(err, undefined)
  }
})
```

#### Catch All

There are some cases where you need to handle requests that do not have a corresponding body parser (such as when a request does not have a `Content-Type` header). This can be done by setting a parser for the `'*'` content type.

```js
app.addBodyParser('*', (req, done) => {
  if (isACertainType(req.headers['content-type'])) {
    parseBody(req, done)
  } else {
    done(undefined)
  }
})
```

## `app.hasBodyParser(contentType)`

This method can be used to check if a specific body parser already exists.

```js
if (!app.hasBodyParser('application/jsoff')){
  app.addBodyParser('application/jsoff', jsoffParser)
}
```
