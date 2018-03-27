# Getting Started

## Installation

```sh
# npm
npm install @medley/medley --save

# yarn
yarn add @medley/medley
```

## Creating a Medley App

### Quick Example

```js
const medley = require('@medley/medley');
const app = medley();

app.get('/', (req, res) => {
  res.send({ hello: 'world' });
});

app.listen(3000);
```

Navigating to `http://localhost:3000` in a browser will display the result:

```json
{"hello":"world"}
```

### Creating the Root `app`

```js
const medley = require('@medley/medley');
const app = medley();
```

Similar to other frameworks, the `medley` module is function that creates a new
`app`. The `medley` function accepts some [options](Medley.md) that configure
how the app will behave.

### Defining Routes

```js
// Express-style
app.get('/', (req, res) => {
  res.send({ hello: 'world' });
});

// Hapi-style
app.route({
  method: 'GET',
  path: '/',
  handler: (req, res) => {
    res.send({ hello: 'world' });
  }
});
```

Medley offers both an Express-style and a Hapi-style syntax for defining
routes. See the [**Routes** documentation](Routes.md) for details.

### Adding Hooks

Hooks are similar to Express middleware. There are different types of hooks
that are run during different parts of a request.

```js
app.addHook('onRequest', (req, res, next) => {
  req.startTime = Date.now();
  next();
});

app.addHook('onSend', (req, res, payload, next) => {
  res.sendStartTime = Date.now();
  next();
});

app.addHook('onFinished', (req, res) => {
  const now = Date.now();
  console.log('Handling time:', res.sendStartTime - req.startTime);
  console.log('Send time:', now - res.sendStartTime);
  console.log('Request time:', now - req.startTime);
});
```

See the [**Hooks** documentation](Hooks.md) for more information. Also check
out the [**Lifecyle** documentation](Lifecyle.md) to see where hooks are
run during the lifetime of a request.

### Adding Decorators

Medley's functionality can be extended by adding decorators to the `app`,
`req`, and `res` objects.

```js
app.decorateRequest('startTime', 0); // Default start time
app.decorateRequest('recordStartTime', function() {
  this.startTime = Date.now();
});

app.addHook('onRequest', (req, res, next) => {
  req.recordStartTime();
  next();
});
```

In addition to adding custom functionality to Medley, decorators are also
useful for "claiming" a property on the `req`, `res`, and `app` objects so
that different parts of an application don't accidentally try to use the
same property for different things.

See the [**Decorators** documentation](Decorators.md) for more information.

### JSON Serialization

Medley includes a feature for serializing JSON objects 2-5x faster than
using `JSON.stringify()`. This is done by setting a `responseSchema` for
the route that defines the expected format of the data that will be sent:

```js
const responseSchema = {
  200: { // The response status code
    hello: { type: 'string' }
  }
};

app.get('/', { responseSchema }, (req, res) => {
  res.send({
    hello: 'world'
  });
});
```

See the [`Serialization` documentation](Serialization.md) for more information.

### Encapsulating Functionality

Hooks, [body parsers](BodyParser.md), and app decorators can be encapsulated within sub-apps to
isolate different functionality to specific parts of an application. Sub-apps are registered with
the [`app.use()`](App.md#use) method.

**app.js**
```js
const medley = require('@medley/medley');
const app = medley();

app.use(require('./userRoutes'));
```

**userRoutes.js**
```js
module.exports = function userRoutes(app) {
  app.addHook('onRequest', require('./authenticationHook'));
  app.get('/user/:userId', (req, res) => { });
};
```

See [`app.use()`](App.md#use), [Hooks Encapsulation](Hooks.md#encapsulation),
[`app.decorate()`](Decorators.md#decorate), and [Route Prefixing](Routes.md#route-prefixing)
for details.

### Starting the Server

```js
app.listen(3000, (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  console.log('Server listening at http://localhost:3000');
});
```

See [`app.listen()`](App.md#listen).


## Other Details

### Body Parsing

Medley has built-in support for body-parsing, although it does not come with any body parsers.
See the [**Body Parser** documentation](BodyParser.md) for details.

### HTTP/2

Medley works with Node's [`HTTP/2` module](https://nodejs.org/api/http2.html).
See the [**HTTP2** documentation](HTTP2.md) to learn how to configure an app
to use HTTP/2.

### Plugins

See the [**Plugins** documentation](Plugins.md).

### Testing

See the [**Testing** documentation](Testing.md).
