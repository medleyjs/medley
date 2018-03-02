<h1 align="center">Fastify</h1>
## Serialization

When sending a JSON response, it is serialized with `JSON.stringify()` by default. However, a response schema can be set to enable the payload to be serialized with [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify) instead. `compile-json-stringify` will stringify the payload 2-8x faster than `JSON.stringify()` and it will exclude any properties that are not included in the schema (which can prevent accidental disclosure of sensitive information, although it is not recommended to use this as the primary method of preventing data leaks).

Example:

```js
const schema = {
  response: {
    200: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        fast: { type: 'boolean' }
      }
    }
  }
}

fastify.get('/info', { schema }, (request, reply) => {
  reply.send({ value: 'medley', fast: true })
})
```

As you can see, the response schema is based on the status code. If you want to use the same schema for multiple status codes, you can use `'2xx'`, for example:
```js
const schema = {
  response: {
    '2xx': {
      type: 'object',
      properties: {
        value: { type: 'string' },
        otherValue: { type: 'boolean' }
      }
    },
    201: {
      type: 'object',
      properties: {
        value: { type: 'string' }
      }
    }
  }
}

fastify.post('/the/url', { schema }, handler)
```

*If you need a custom serializer in a very specific part of your code, you can set one with `reply.serializer(...)`.*

For more information on how to define a response schema, see the [`compile-json-stringify` documentation](https://github.com/nwoltman/compile-json-stringify).
