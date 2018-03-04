# Serialization

When sending a JSON response, it is serialized with `JSON.stringify()` by default. However, a response schema can be set to enable the payload to be serialized with [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify) instead. `compile-json-stringify` will stringify the payload 2-8x faster than `JSON.stringify()` and it will exclude any properties that are not included in the schema (which can prevent accidental disclosure of sensitive information, although it is not recommended to use this as the primary method of preventing data leaks).

**Example:**

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      value: { type: 'string' },
      fast: { type: 'boolean' }
    }
  }
}

fastify.get('/info', { responseSchema }, (request, reply) => {
  reply.send({ value: 'medley', fast: true })
})
```

The example above shows that the structure of the schema is a mapping of a *status code* to a *`compile-json-stringify` schema*. Different schemas can be set for different status codes.

**Example:**

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      value: { type: 'string' },
      fast: { type: 'boolean' }
    }
  },
  201: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: ['string', 'null'] }
    }
  }
}

fastify.post('/info', { responseSchema }, (request, reply) => {
  if (request.body.createInfo) {
    // Create info ...
    reply.code(201).send({ success: true, error: null })
  } else {
    reply.send({ value: 'medley', fast: true })
  }
})
```

`compile-json-stringify` works just like `JSON.stringify()` ([mostly](https://github.com/nwoltman/compile-json-stringify#differences-from-jsonstringify)). If a part of the payload being sent doesn't match the schema, it will still be serialized.

**Example:**

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      value: { type: 'string' }
    }
  }
}

fastify.get('/mismatch', { responseSchema }, (request, reply) => {
  reply.send({ value: [1, 2, 3] }) // Gets serialized to: '{ "value": [1, 2, 3] }'
})
```

For more information on how to define a response schema, see the [`compile-json-stringify` documentation](https://github.com/nwoltman/compile-json-stringify).
