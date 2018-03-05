'use strict'

const t = require('tap')
const test = t.test
const decorator = require('../../lib/decorate')

test('decorate should add the given method to its subApp', (t) => {
  t.plan(1)

  function build() {
    server.decorateApp = decorator.decorateApp
    return server

    function server() {}
  }

  const server = build()
  server.decorateApp('test', () => {})
  t.ok(server.test)
})

test('decorate is chainable', (t) => {
  t.plan(3)

  function build() {
    server.decorateApp = decorator.decorateApp
    return server

    function server() {}
  }

  const server = build()
  server
    .decorateApp('test1', () => {})
    .decorateApp('test2', () => {})
    .decorateApp('test3', () => {})

  t.ok(server.test1)
  t.ok(server.test2)
  t.ok(server.test3)
})
