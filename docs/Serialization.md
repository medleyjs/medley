# Serialization

When sending a JSON response, it is serialized with `JSON.stringify()` by default. However, a response schema can be set to enable the payload to be serialized with [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify) instead. `compile-json-stringify` will stringify the payload 2-8x faster than `JSON.stringify()` and it will exclude any properties that are not included in the schema (which can prevent accidental disclosure of sensitive information, although it is not recommended to use this as the primary method of preventing data leaks).

**Example:**

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      hello: { type: 'string' }
    }
  }
}

app.get('/', { responseSchema }, (req, res) => {
  res.send({ hello: 'world' })
})
```

The structure of the schema is a mapping of a *status code* to a *`compile-json-stringify` schema*. Different schemas can be set for different status codes.

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

app.post('/info', { responseSchema }, (req, res) => {
  if (req.body.createInfo) {
    // Create info ...
    res.status(201).send({ success: true, error: null })
  } else {
    res.send({ value: 'medley', fast: true })
  }
})
```

For more information on how to define a response schema, see the [`compile-json-stringify` documentation](https://github.com/nwoltman/compile-json-stringify).

## Object Shorthand

Medley lets you use a "shorthand" format for object schema definitions. If the schema is missing the `type` and `properties` keyword properties, Medley will wrap it in a `{type: 'object', properties: yourSchema}` object so that it will be compiled properly.

```js
const responseSchema = {
  200: {
    hello: { type: 'string' }
  }
}

app.get('/', { responseSchema }, (req, res) => {
  res.send({ hello: 'world' })
})
```

## Incorrect Types in the Payload

`compile-json-stringify` works just like `JSON.stringify()` ([mostly](https://github.com/nwoltman/compile-json-stringify#differences-from-jsonstringify)). If a part of the payload being sent doesn't match the schema, it will still be serialized.

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      value: { type: 'string' }
    }
  }
}

app.get('/mismatch', { responseSchema }, (req, res) => {
  res.send({ value: [1, 2, 3] }) // Gets serialized to: '{"value":[1,2,3]}'
})
```
