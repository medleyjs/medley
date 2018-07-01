# Plugins

Plugins are useful for adding specific functionality to a Medley app
(or sub-app) in a configurable way. A plugin can be added to an app
with the `app.register()` method.

```js
app.register(plugin [, options])
```

The `.register()` method takes two parameters:

+ `plugin` *(function)* - The plugin function that adds functionality to the `app`.
+ `options` *(object | any)* - Options that will be passed to the `plugin` function.

The `plugin` function will receive two parameters:

+ `app` - The [`app` instance](App.md) the plugin is being registered on.
+ `options` *(object | any)* - The options passed to `.register()`.

#### Example:

**my-plugin.js**
```js
function myPlugin(app, options) {
  app.decorate('myPluginData', {
    receivedOptions: options,
    exampleData: 'value'
  });

  app.addHook('onRequest', (req, res, next) => { ... });
}

module.exports = myPlugin
```

**app.js**
```js
const medley = require('@medley/medley');
const app = medley();

app.register(require('./my-plugin'), {x: 1, y: 2});

console.log(app.myPluginData.receivedOptions); // {x: 1, y: 2}
console.log(app.myPluginData.exampleData); // 'value'
```

#### Side Note

From the above, it looks like `app.register()` could be avoided by doing the following:

```js
const myPlugin = require('./my-plugin');
myPlugin(app, options);
```

While that should work in most cases, using `app.register()` is the preferred
way to register plugins because the code is clearer and it ensures that all
plugins will provide the same, consistent interface.

Furthermore, `app.register()` provides the following additional functionality:


## Plugin Dependency-Checking

> **Status:** Experimental

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
};

module.exports = myPlugin;
```

The `name` property tells Medley the plugin's name and the `dependencies`
property is an array of the names of plugins that the plugin depends on.

Here is a full example of this feature:

**cookie-plugin.js**
```js
function cookiePlugin(app, options) { }

cookiePlugin.meta = {
  name: 'cookie-plugin'
};

module.exports = cookiePlugin;
```

**session-plugin.js**
```js
function sessionPlugin(app, options) { }

sessionPlugin.meta = {
  name: 'session-plugin',
  dependencies: ['cookie-plugin']
};

module.exports = sessionPlugin;
```

**app.js**
```js
const medley = require('@medley/medley');
const app = medley();

app.register(require('./cookie-plugin'));
app.register(require('./session-plugin'));
```

Everything works because the `cookie-plugin` was registered before the
`session-plugin`. But if the `session-plugin` were registered first:

```js
app.register(require('./session-plugin')); // AssertionError!
app.register(require('./cookie-plugin'));
```

An error is thrown because the `session-plugin` depends on the `cookie-plugin`
but the `cookie-plugin` hadn't been registered yet.

Using this dependency-checking feature not only ensures that plugin
dependencies are met, but also that plugins are registered in the
right order. For example, hooks added by the `cookie-plugin` above
would need to run before hooks added by the `session-plugin`.
