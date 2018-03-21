# Plugins

Plugins are useful for adding specific functionality to a Medley app
(or sub-app) in a configurable way. A plugin can be added to an app
with the `app.registerPlugin()` method.

```js
app.registerPlugin(plugin [, options])
```

The `.registerPlugin()` method takes two parameters:

+ `plugin` *(function)* - The plugin function that adds functionality to the `app`.
+ `options` *(object | any)* - The options that will be passed to the `plugin` function.

The `plugin` function will receive two parameters:

+ `app` - The `app` instance the plugin is being registered on.
+ `options` *(object | any)* - The options that were passed to `.registerPlugin()`.

#### Example:

**my-plugin.js**
```js
function myPlugin(app, options) {
  app.decorate('myPluginData', {
    receivedOptions: options,
    example: 'value'
  })
  app.addHook('onRequest', (req, res, next) => { ... })
  app.get('/my-plugin/route', (req, res) => { ... })
  // etc.
}
module.exports = myPlugin
```

**app.js**
```js
const medley = require('@medley/medley')
const myPlugin = require('./my-plugin')
const app = medley()

app.registerPlugin(myPlugin, {optional: 'options'})

console.log(app.myPluginData.receivedOptions) // {optional: 'options'}
console.log(app.myPluginData.example) // 'value'
```

Using `app.registerPlugin()` is almost the exact same as doing the following:

```js
const myPlugin = require('./my-plugin')
myPlugin(app, options)
```

It is perfectly acceptable to do that, however, `.registerPlugin()` is a
slightly more convenient way of writing the code above, and it also
provides the following additional functionality:


## Plugin Dependency-Checking

Sometimes a plugin may depend on the functionality of another plugin. In that
case it helps to ensure that plugin dependencies are met when a plugin is
registered. To hook into this feature, metadata can be added to the plugin
for Medley to use to check dependencies.

To add metadata to a plugin, add a `meta` property to the plugin function:

```js
function myPlugin(app, options) {
  // ...
}

myPlugin.meta = {
  name: 'my-plugin',
  dependencies: [] // Array of plugin names
}

module.exports = myPlugin
```

The `name` property tells Medley the plugin's name and the `dependencies`
property is an array of the names of plugins that the plugin depends on.

Here is a full example of this feature:

**cookie-plugin.js**
```js
function cookiePlugin(app, options) { }

cookiePlugin.meta = {
  name: 'cookie-plugin'
}

module.exports = cookiePlugin
```

**session-plugin.js**
```js
function sessionPlugin(app, options) { }

sessionPlugin.meta = {
  name: 'session-plugin',
  dependencies: ['cookie-plugin']
}

module.exports = sessionPlugin
```

**app.js**
```js
const medley = require('@medley/medley')
const app = medley()

app.registerPlugin(require('./cookie-plugin'))
app.registerPlugin(require('./session-plugin'))
```

Everything works because the `cookie-plugin` was registered before the
`session-plugin`. But if the `session-plugin` were registered first:

```js
app.registerPlugin(require('./session-plugin')) // AssertionError!
app.registerPlugin(require('./cookie-plugin'))
```

An error is thrown because the `session-plugin` depends on the `cookie-plugin`
but the `cookie-plugin` hadn't been registered yet.

Using this dependency-checking feature not only ensures that plugin
dependencies are met, but also that plugins are registered in the
right order. For example, hooks added by the `cookie-plugin` above
would need to run before hooks added by the `session-plugin`.
