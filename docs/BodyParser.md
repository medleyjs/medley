# Body Parser

Medley has built-in support for body-parsing. The [`app.addBodyParser()`](#appaddbodyparser) method
can be used to add body parsers to an app (or sub-app). When a body is parsed, it is added to the
Medley [`req`](Request.md) object as `req.body`. Medley does not come with any body parsers, so
check out the [`@medley/body-parser`](https://github.com/medleyjs/body-parser) package for the
basic set of body parsers.

Similar to hooks, body parsers are encapsulated within the scope in which they
are declared. This means that if a parser is declared in the root scope, it
will be available everywhere, whereas if it is declared inside a sub-app, it
will be available only in that scope and its children.

## `app.addBodyParser()`

```js
app.addBodyParser(contentType, parser)
```

+ `contentType` *(string)* - The Content-Type (MIME type) to parse.
+ `parser(req, done)` *(function)* - A function to parse the request body that takes the following parameters:
  + `req` - The Medley [`Request`](Request.md) object.
  + `done(error, body)` - Callback to call when done parsing the body or if an error occurred. The parsed body must be passed as the second parameter.

Example that uses [`raw-body`](https://github.com/stream-utils/raw-body):

```js
const rawBody = require('raw-body')

app.addBodyParser('text/plain', (req, done) => {
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

app.addBodyParser('text/plain', async (req) => {
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
app.addBodyParser('text/plain', (req) => {
  return rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  })
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
    done()
  }
})
```

## `app.hasBodyParser(contentType)`

This method can be used to check if a specific body parser already exists.

```js
if (!app.hasBodyParser('application/json')){
  app.addBodyParser('application/json', jsonParser)
}
```
