# Body Parser

Medley comes with only a body parser for the `application/json` Content-Type
out of the box. To parse other content types, `app.addBodyParser()` can be
used to add more body parsers. When a body is parsed, it is added to the
Medley [`req`](Request.md) object as `req.body`.

Similar to hooks, body parsers are encapsulated within the scope in which they
are declared. This means that if a parser is declared in the root scope, it
will be available everywhere, whereas if it is declared inside a sub-app, it
will be available only in that scope and its children.

If needed, the default JSON parser can be overridden by adding a parser with
the Content-Type `'application/json'`.

## `app.addBodyParser()`

#### Streaming Parsing

```js
app.addBodyParser(contentType, parser(req, done))
```

+ `contentType` *(string)* - The Content-Type (MIME type) to parse.
+ `parser` *(function)* - A function to parse the request body that takes the following parameters:
  + `req` - The Medley [`Request`][Request.md] object.
  + `done(error, body)` - Callback to call when done parsing the body or if an error occurred.

Example that uses [`raw-body`](https://github.com/stream-utils/raw-body):

```js
const rawBody = require('raw-body')

app.addBodyParser('text/html', (req, done) => {
  rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  }, done)
})
```

If using an `async` function, return the parsed body instead of calling the `done` callback:

```js
const rawBody = require('raw-body')

app.addBodyParser('text/html', async (req) => {
  const body = await rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  })
  return body
})
```

Note that since there is only a single `await` in the example above,
it could be simplified to just return the promise:

```js
app.addBodyParser('text/html', (req) => {
  return rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  })
})
```

#### Collected-Body Parsing

```js
app.addBodyParser(contentType, options, parser(req, body, done))
```

+ `contentType` *(string)* - The Content-Type to parse.
+ `options` *(object)* - Options object that can have the following options:
  + `parseAs` *(string)* - Either `'buffer'` or `'string'` to indicate how the incoming data should be collected. Defaults to `undefined`.
  + `bodyLimit` *(number)* - The maximum payload size (in bytes) that the custom parser will accept. Defaults to the global body limit passed to the [`Medley factory function`](Factory.md#bodylimit). If the limit is exceeded, the `parser` function will not be invoked.
+ `parser` *(function)* - A function to parse the request body that takes the following parameters:
  + `req` - The Medley [`Request`][Request.md] object.
  + `body` *(buffer|string)* - The collected body. The type depends on the `parseAs` option.
  + `done(error, body)` - Callback to call when done parsing the body or if an error occurred.

By using the `parseAs` option, the request body will be collected as either a `buffer`
or a `string` and then passed to the `parser` function as the second argument.

```js
app.addBodyParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  var json
  try {
    json = JSON.parse(body)
  } catch (err) {
    err.statusCode = 400
    return done(err)
  }
  done(null, json)
})
```

Medley supports parsing `application/json` by default though, so here's an
example of how to add a `text/plain` body parser:

```js
app.addBodyParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
  done(null, body)
})
```

#### Catch All

Sometimes it may be necessary to handle requests that do not have a corresponding
body parser (such as when a request does not have a `Content-Type` header). This
can be done by setting a parser for the `'*'` content type.

```js
app.addBodyParser('*', (req, done) => {
  if (isACertainType(req.headers['content-type'])) {
    parseBody(req.stream, done)
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
