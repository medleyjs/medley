# Content Type Parser
Natively, Medley only supports the `'application/json'` content type. If you need to support different content types, you can use the `addContentTypeParser` API. *The default JSON parser can be changed.*

As with the other APIs, `addContentTypeParser` is encapsulated in the scope in which it is declared. This means that if you declare it in the root scope it will be available everywhere, while if you declare it inside a register it will be available only in that scope and its children.

Medley adds automatically the parsed request payload to the [Medley request](Request.md) object, you can reach it with `request.body`.

### Usage
```js
app.addContentTypeParser('application/jsoff', function (req, done) {
  jsoffParser(req, function (err, body) {
    done(err, body)
  })
})
// async also supported in Node versions >= 8.0.0
app.addContentTypeParser('application/jsoff', async function (req) {
  var res = await new Promise((resolve, reject) => resolve(req))
  return res
})
```

You can also use the `hasContentTypeParser` API to find if a specific content type parser already exists.

```js
if (!app.hasContentTypeParser('application/jsoff')){
  app.addContentTypeParser('application/jsoff', function (req, done) {
    //code to parse request body /payload for given content type
  })
}
```

#### Body Parser
You can parse the body of the request in two ways. The first one is shown above: you add a custom content type parser and handle the request stream. In the second one you should pass a `parseAs` option to the `addContentTypeParser` API, where you declare how you want to get the body, it could be `'string'` or `'buffer'`. If you use the `parseAs` option Medley will internally handle the stream and perform some checks, such as the [maximum size](Factory.md#bodylimit) of the body and the content length. If the limit is exceeded the custom parser will not be invoked.
```js
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    var json = JSON.parse(body)
    done(null, json)
  } catch (err) {
    err.statusCode = 400
    done(err, undefined)
  }
})
```
As you can see, now the function signature is `(req, body, done)` instead of `(req, done)`.

##### Custom Parser Options
+ `parseAs` (string): Either `'string'` or `'buffer'` to designate how the incoming data should be collected. Default: `'buffer'`.
+ `bodyLimit` (number): The maximum payload size, in bytes, that the custom parser will accept. Defaults to the global body limit passed to the [`Medley factory function`](Factory.md#bodylimit).

#### Catch All
There are some cases where you need to catch all requests regardless of their content type. With Medley, you just need to add the `'*'` content type.
```js
app.addContentTypeParser('*', function (req, done) {
  var data = ''
  req.on('data', chunk => { data += chunk })
  req.on('end', () => {
    done(null, data)
  })
})
```

In this way, all of the requests that do not have a corresponding content type parser will be handled by the specified function.
