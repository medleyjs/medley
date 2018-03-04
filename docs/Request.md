# Request

The first parameter of the handler function is `Request`.<br>
Request is a core Medley object containing the following fields:

- `req` - The [`http.IncomingMessage`](https://nodejs.org/dist/latest/docs/api/http.html#http_class_http_incomingmessage) from Node core.
- `headers` - The request's HTTP headers.
- `params` - The parameters matched in the URL.
- `query` - The parsed query string.
- `body` - The parsed body of the request.

```js
app.post('/:foo', (request, reply) => {
  console.log(request.req)
  console.log(request.headers)
  console.log(request.params)
  console.log(request.query)
  console.log(request.body)
  reply.send(request.params.foo)
})
```
