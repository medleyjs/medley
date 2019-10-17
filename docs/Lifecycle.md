# Lifecycle

```
Incoming Request
  │
  └─▶ Routing
        │
        └─▶ onRequest Hooks
              │
              └─▶ Route Handler
                    |
                    └─▶ Serialize Body
                          │
                          └─▶ onSend Hooks
                                │
                                └─▶ Send Response
                                      │
                                      └─▶ onFinished Hooks
```

**Lifecycle Stages:**

1. [Routing](#routing)
1. [onRequest Hooks](#onrequest-hooks)
1. [Route Handler](#route-handler)
1. [Serialize Body](#serialize-body)
1. [onSend Hooks](#onsend-hooks)
1. [Send Response](#send-response)
1. [onFinished Hooks](#onfinished-hooks)
1. [onError Hooks](#onerror-hooks)

## Routing

The first step Medley takes after receiving a request is to find the route that matches the URL of the request.

Medley uses [`@medley/router`](https://www.npmjs.com/package/@medley/router) for routing.

## `onRequest` Hooks

[`onRequest` hooks](Hooks.md#onRequest-hook) are the first hooks that are run once a request is matched with a route.

```js
app.addHook('onRequest', (req, res, next) => {
  // Do something, like authenticate the user
  next();
});
```

These hooks may send an early response with `res.send()`. If a hook does this, the rest of the hooks will be skipped and the lifecycle will go straight to the [*Serialize Body*](#serialize-body) step.

#### Route-level `preHandler`

Routes can define `preHandler` hooks, which are essentially route-level `onRequest` hooks.
They run after the global `onRequest` hooks, and just before the route handler.

```js
app.get('/', {
  preHandler: (req, res, next) => {
    // Do something, like validate the request body
    next();
  }
}, function handler(req, res) => {
  res.send();
});
```

## Route Handler

This is the main function that sends the response.

```js
app.get('/', (req, res) => {
  res.send('body');
});
```

See the [`Routes` documentation](Routes.md) for more information on route handlers.

#### Not-Found Handler

If the request URL does not match any routes, the [`notFoundHandler`](Medley.md#notfoundhandler) is invoked. Global hooks **are** run before/after this handler.

#### Method-Not-Allowed Handler

If the request URL matches a route but has no handler for the request method, the [`methodNotAllowedHandler`](Medley.md#methodnotallowedhandler) is invoked. Global hooks **are** run before/after this handler.

## Serialize Body

In this step, the body that was passed to `res.send()` is serialized (if it needs to be) and an appropriate `Content-Type` is set (if one was not already set).

See the [`res.send()`](Response.md#send) and [Serialization](Serialization.md) documentation for more information.

## `onSend` Hooks

[`onSend` hooks](Hooks.md#onSend-hook) are run after the body has been serialized and before the response is sent to the client.

```js
app.addHook('onSend', (req, res, body, next) => {
  // Do something, like save the session state
  next();
});
```

## Send Response

The response is sent to the client. Medley handles this step automatically.

## `onFinished` Hooks

[`onFinished` hooks](Hooks.md#onFinished-hook) are run once the response has finished sending
(or if the underlying connection was terminated before the response could finish sending).

```js
app.addHook('onFinished', (req, res) => {
  // Do something, like log the response time
});
```

## `onError` Hooks

If an error occurs during the request lifecycle, it will be sent to the [`onError` hooks](Hooks.md#onError-hook).

```js
app.addHook('onError', (err, req, res, next) => {
  // Send an error response
});
```

Here’s how the `onError` hooks fit into the lifecycle:

```
Routing
  │
  └─▶ onRequest Hooks  ╌╌╌╌╌╌╌╌╌ (error) ╌╌╌╌╌╌╌╌╌╌╌┐
        │                                           ⯆
        └─▶ Route Handler  ╌╌╌╌ (error) ╌╌╌▶ onError Hooks
              |                                     ┆
              └─▶ Serialize Body ◀╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
                    │
                    └─▶ onSend Hooks
                          │
                          └─▶ Send Response
```
