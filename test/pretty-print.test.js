'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('pretty print - static routes', t => {
  t.plan(2)

  const app = medley()
  app.get('/test', () => {})
  app.get('/test/hello', () => {})
  app.get('/hello/world', () => {})

  app.ready(() => {
    const tree = app.printRoutes()

    const expected = `└── /
    ├── test (GET)
    │   └── /hello (GET)
    └── hello/world (GET)
`

    t.is(typeof tree, 'string')
    t.equal(tree, expected)
  })
})

test('pretty print - parametric routes', t => {
  t.plan(2)

  const app = medley()
  app.get('/test', () => {})
  app.get('/test/:hello', () => {})
  app.get('/hello/:world', () => {})

  app.ready(() => {
    const tree = app.printRoutes()

    const expected = `└── /
    ├── test (GET)
    │   └── /
    │       └── :hello (GET)
    └── hello/
        └── :world (GET)
`

    t.is(typeof tree, 'string')
    t.equal(tree, expected)
  })
})

test('pretty print - mixed parametric routes', t => {
  t.plan(2)

  const app = medley()
  app.get('/test', () => {})
  app.get('/test/:hello', () => {})
  app.post('/test/:hello', () => {})
  app.get('/test/:hello/world', () => {})

  app.ready(() => {
    const tree = app.printRoutes()

    const expected = `└── /
    └── test (GET)
        └── /
            └── :hello (GET)
                :hello (POST)
                └── /world (GET)
`

    t.is(typeof tree, 'string')
    t.equal(tree, expected)
  })
})

test('pretty print - wildcard routes', t => {
  t.plan(2)

  const app = medley()
  app.get('/test', () => {})
  app.get('/test/*', () => {})
  app.get('/hello/*', () => {})

  app.ready(() => {
    const tree = app.printRoutes()

    const expected = `└── /
    ├── test (GET)
    │   └── /
    │       └── * (GET)
    └── hello/
        └── * (GET)
`

    t.is(typeof tree, 'string')
    t.equal(tree, expected)
  })
})
