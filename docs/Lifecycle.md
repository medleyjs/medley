# Lifecycle

```
Incoming Request
  │
  └─▶ Routing
        │
        └─▶ onRequest Hooks
              │
              └─▶ Route Handler || Not-Found Handler || Error Handler
                    |
                    └─▶ Serialize Payload
                          │
                          └─▶ onSend Hooks
                                │
                                └─▶ Send Response
                                      │
                                      └─▶ onFinished Hooks
```

**Table of Contents:**

1. [Routing](#routing)
1. [onRequest Hook](#onrequest-hook)
1. [Route Handler](#route-handler)
1. [Serialize Payload](#serialize-payload)
1. [onSend Hook](#onsend-hook)
1. [Send Response](#send-response)
1. [onFinished Hook](#onfinished-hook)

## Routing

The first step Medley takes after receiving a request is to look up a route that matches the URL of the request.

If no route matches the request, a not-found handler that matches the URL is selected (or the default not-found handler is used if no handlers set with [`app.setNotFoundHandler()`](App.md#set-not-found-handler) were a match).

If the request method is not one of the [supported HTTP methods](https://nodejs.org/api/http.html#http_http_methods), a `501 Not Implemented` error response is sent immediately and the entire lifecycle is skipped.

## `onRequest` Hooks

[`onRequest` hooks](Hooks.md#onRequest-hook) are the first hooks that are run once a request is matched with a route.

```js
app.addHook('onRequest', (req, res, next) => {
  // Do something, like authenticate the user
  next();
});
```

These hooks may send an early response with `res.send()`. If a hook does this, the rest of the hooks will be skipped and the lifecycle will go straight to the [*Serialize Payload*](#serialize-payload) step.

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

This is the main handler for the route. The route handler sends the response payload.

```js
app.get('/', (req, res) => {
  res.send('payload');
});
```

See the [`Routes` documentation](Routes.md) for more information on route handlers.

#### Not-Found Handler

If the request URL does not match any routes, a *not-found handler* (set with [`app.setNotFoundHandler()`](App.md#set-not-found-handler)) is invoked. Global hooks **are** run before the not-found handler.

#### Error handler

If an error occurs at any point in the request lifecycle, the request skips straight to the *error handler*, which sends an error response. A custom error handler can be set with [`app.setErrorHandler()`](App.md#set-error-handler).

## Serialize Payload

In this step, the payload that was passed to `res.send()` is serialized (if it needs to be) and an appropriate `Content-Type` for the payload is set (if one was not already set).

See the [`res.send()`](Response.md#send) and [Serialization](Serialization.md) documentation for more information.

## `onSend` Hooks

[`onSend` hooks](Hooks.md#onSend-hook) are run after the payload has been serialized and before the payload is sent to the client.

```js
app.addHook('onSend', (req, res, payload, next) => {
  // Do something, like save the session state
  next();
});
```

If an error occurs during a hook, the rest of the hooks are skipped and the error handler is invoked. The `onSend` hooks will **not** be run again when the error response is sent.

## Send Response

The serialized payload is sent to the client. Medley handles this step automatically.

## `onFinished` Hooks

[`onFinished` hooks](Hooks.md#onFinished-hook) are run once the response has finished sending
(or if the underlying connection was terminated before the response could finish sending).

```js
app.addHook('onFinished', (req, res) => {
  // Do something, like log the response time
});
```
