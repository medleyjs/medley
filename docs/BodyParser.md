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

+ `contentType` *(string | string[] | function)* - The MIME type(s) to parse or a custom function to match the `Content-Type` header.
+ `parser(req, done)` *(function)* - A function to parse the request body that takes the following parameters:
  + `req` - The Medley [`Request`](Request.md) object.
  + `done(error, body)` - Callback to call when done parsing the body or if an error occurred. The parsed body must be passed as the second parameter.

```js
const bodyParser = require('@medley/body-parser');
const medley = require('@medley/medley');
const app = medley();

app.addBodyParser('application/json', bodyParser.json());
```

The `contentType` parameter may be a string or an array of strings that match the formats allowed
by [`compile-mime-match`](https://github.com/medleyjs/compile-mime-match#usage). It may also be a
function that takes the received `Content-Type` header as the first parameter and returns `true`
or `false` to indicate whether or not the corresponding parser should parse the request body.

Example of the `contentType` parameter as a function:

```js
function matchType(contentType) {
  if (contentType === 'application/octet-stream') {
    return false;
  }
  return true;
}

app.addBodyParser(matchType, (req, done) => { /* ... */ });
```

**Note:** If the `Content-Type` header was missing, then the `contentType` matcher
function will receive an empty string `''` as the first argument.

In the `parser` function, the request body can be read from the `req.stream` property.
Here's an example that uses [`raw-body`](https://github.com/stream-utils/raw-body):

```js
const rawBody = require('raw-body');

app.addBodyParser('text/plain', (req, done) => {
  rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  }, done);
});
```

If using an `async` function, the parsed body must be returned instead of calling the `done` callback:

```js
const rawBody = require('raw-body');

app.addBodyParser('text/plain', async (req) => {
  const body = await rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  });
  return body;
});
```

Note that since there is only a single `await` in the example above,
it could be simplified to just return the promise:

```js
app.addBodyParser('text/plain', (req) => {
  return rawBody(req.stream, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf8',
  });
});
```

#### Match Order

Body parsers are matched in the order in which they were added. In the following example,
`application/json` requests will never be handled by the second body parser because they
will always be matched by the first one.

```js
const bodyParser = require('@medley/body-parser');

app.addBodyParser('application/*', bodyParser.buffer());
app.addBodyParser('application/json', bodyParser.json()); // Will never be matched
```

For this reason, it is better to declare body parsers with specific MIME types
*before* parsers with a type that has a wildcard.

#### Content-Type Match Caching

When the incoming `Content-Type` header matches a body parser, the pair is cached to speed up future
lookups of the body parser for the same `Content-Type`. This fact may need to be taken into account
when implementing a custom `contentType` matching function since the function will not always be
called for requests with the same `Content-Type` header if it previously returned `true` for a
request with that `Content-Type` header.
