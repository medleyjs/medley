# Getting Started
Hello! Thank you for checking out Medley!<br>
This document aims to be a gentle introduction to the framework and its features. It is an elementary introduction with examples and links to other parts of the documentation.<br>
Let's start!

<a name="install"></a>
### Install
```
npm i @medley/medley --save
```
<a name="first-server"></a>
### Your first server
Let's write our first server:
```js
// Require the framework and instantiate it
const app = require('medley')()

// Declare a route
app.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})

// Run the server!
app.listen(3000, function (err) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

Do you prefer to use `async/await`? Medley supports it out-of-the-box.<br>
*(we also suggest using [make-promises-safe](https://github.com/mcollina/make-promises-safe) to avoid file descriptor and memory leaks)*
```js
const app = require('medley')()

app.get('/', async (request, reply) => {
  return { hello: 'world' }
})

const start = async () => {
  try {
    await app.listen(3000)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
start()
```

Awesome, that was easy.<br>
Unfortunately, writing a complex application requires significantly more code than this example. A classic problem when you are building a new application is how handle multiple files, asynchronous bootstrapping and the architecture of your code.<br>
Medley offers an easy platform that helps solve all of problems, and more.

> ## Note
> The above examples, and subsequent examples in this document, default to listening *only* on the localhost `127.0.0.1` interface. To listen on all available IPv4 interfaces the example should be modified to listen on `0.0.0.0` like so:
>
> ```js
> app.listen(3000, '0.0.0.0', function (err) {
>   if (err) {
>     console.error(err)
>     process.exit(1)
>   }
> })
> ```
>
> Similarly, specify `::1` to accept only local connections via IPv6. Or specify `::` to accept connections on all IPv6 addresses, and, if the operating system supports it, also on all IPv4 addresses.
>
> When deploying to a Docker, or other type of, container this would be the easiest method for exposing the application.

<a name="first-plugin"></a>
### Your first plugin
As with JavaScript everything is an object, with Medley everything is a plugin.<br>
Before digging into it, let's see how it works!<br>
Let's declare our basic server, but instead of declaring the route inside the entry point, we'll declare it in an external file (check out the [route declaration](Routes.md) docs).
```js
const app = require('medley')()

app.register(require('./our-first-route'))

app.listen(3000, function (err) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

```js
// our-first-route.js

async function routes (app, options) {
  app.get('/', async (request, reply) => {
    return { hello: 'world' }
  })
}

module.exports = routes
```
In this example we used the `register` API. This API is the core of the Medley framework, and is the only way to register routes, plugins and so on.

At the beginning of this guide we noted that Medley provides a foundation that assists with the asynchronous bootstrapping of your an application. Why this is important?
Consider the scenario where a database connection is needed to handle data storage. Obviously the database connection needs to be available prior to the server accepting connections. How do we address this problem?<br>
A typical solution is to use a complex callback, or promises, system that will mix the framework API with other libraries and the application code.<br>
Medley handles this internally, with minimum effort!

Let's rewrite the above example with a database connection.

**server.js**
```js
const app = require('medley')()

app.register(require('./our-db-connector'), {
  url: 'mongodb://localhost:27017/'
})
app.register(require('./our-first-route'))

app.listen(3000, function (err) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
```

**our-db-connector.js**
```js
const fastifyPlugin = require('fastify-plugin')
const MongoClient = require('mongodb').MongoClient

async function dbConnector (app, options) {
  const url = options.url
  delete options.url

  const db = await MongoClient.connect(url, options)
  app.decorate('mongo', db)
}

// Wrapping a plugin function with fastify-plugin exposes the decorators
// and hooks declared inside the plugin to the parent scope.
module.exports = fastifyPlugin(dbConnector)
```

**our-first-route.js**
```js
async function routes (app, options) {
  const database = app.mongo.db('db')
  const collection = database.collection('test')

  app.get('/', async (request, reply) => {
    return { hello: 'world' }
  })

  app.get('/search/:id', async (request, reply) => {
    try {
      return await collection.findOne({ id: request.params.id })
    } catch (err) {
      return new Error('Something went wrong')
    }
  })
}

module.exports = routes
```

Wow, that was fast!<br>
Let's recap what we have done here since we've introduced some new concepts.<br>
As you can see, we used `register` both for the database connector and the routes registration.
This is one of the best features of Medley, it will load your plugins in the same order you declare them, and it will load the next plugin only once the current one has been loaded. In this way we can register the database connector in the first plugin and use it in the second *(read [here](Plugins.md#handle-the-scope) to understand how to handle the scope of a plugin)*.
Plugin loading starts when you call `app.listen()`, `app.inject()` or `app.ready()`

We have used the `decorate` api API. Let's take a moment to understand what it is and how it works. A scenario is to use the same code/library in different parts of an application. A solution is to require the code/library that it is needed. it This works, but is annoying because of duplicated code repeated and, if needed, long refactors.<br>
To solve this Medley offers the `decorate` API, which adds custom objects to the Medley namespace, so that they can be used everywhere.

To dig deeper into how Medley plugins work, how to develop new plugins, and for details on how to use the whole Medley API to deal with the complexity of asynchronously bootstrapping an application, read [the hitchhiker's guide to plugins](Plugins-Guide.md).

<a name="plugin-loading-order"></a>
### Loading order of your plugins
To guarantee a consistent and predictable behavior of your application, we highly recommend to always load your code as shown below:
```
└── plugins (from the Medley ecosystem)
└── your plugins (your custom plugins)
└── decorators
└── hooks
└── your services
```
In this way you will always have access to all of the properties declared in the current scope.<br/>
As discussed previously, Medley offers a solid encapsulation model, to help you build your application as single and independent services. If you want to register a plugin only for a subset of routes, you have just to replicate the above structure.
```
└── plugins (from the Medley ecosystem)
└── your plugins (your custom plugins)
└── decorators
└── hooks
└── your services
    │
    └──  service A
    │     └── plugins (from the Medley ecosystem)
    │     └── your plugins (your custom plugins)
    │     └── decorators
    │     └── hooks
    │     └── your services
    │
    └──  service B
          └── plugins (from the Medley ecosystem)
          └── your plugins (your custom plugins)
          └── decorators
          └── hooks
          └── your services
```

### Serialization

Medley has first-class support for JSON and can serialize JSON 2-5x faster if a response schema is set. Here's an example:

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      hello: { type: 'string' }
    }
  }
}

app.get('/', { responseSchema }, (request, reply) => {
  reply.send({ hello: 'world' })
})
```

For more details on JSON serialization, check out the [`Serialization` documentation](Serialization.md).

<a name="extend-server"></a>
### Extend your server
Medley is a minimal framework that is very extensible. Plugins can be found on [npm](https://www.npmjs.com) (such as plugins published under the [`@medley`](https://www.npmjs.com/org/medley) scope).

<a name="test-server"></a>
### Test your server
Medley does not offer a testing framework, but we do recommend a way to write your tests that uses the features and the architecture of Medley.<br>
Read the [testing](Testing.md) documentation to learn more!

<a name="slides"></a>
### Slides and Videos
- Slides
  - [Take your HTTP server to ludicrous speed](https://mcollina.github.io/take-your-http-server-to-ludicrous-speed) by [@mcollina](https://github.com/mcollina)
  - [What if I told you that HTTP can be fast](https://delvedor.github.io/What-if-I-told-you-that-HTTP-can-be-fast) by [@delvedor](https://github.com/delvedor)

- Videos
  - [Take your HTTP server to ludicrous speed](https://www.youtube.com/watch?v=5z46jJZNe8k) by [@mcollina](https://github.com/mcollina)
  - [What if I told you that HTTP can be fast](https://www.webexpo.net/prague2017/talk/what-if-i-told-you-that-http-can-be-fast/) by [@delvedor](https://github.com/delvedor)
