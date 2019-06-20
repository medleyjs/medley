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
