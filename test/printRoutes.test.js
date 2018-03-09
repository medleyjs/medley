'use strict'

const t = require('tap')
const test = t.test
const medley = require('..')

test('printRoutes() - static routes', (t) => {
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

test('printRoutes() - parametric routes', (t) => {
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

test('printRoutes() - mixed parametric routes', (t) => {
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

test('printRoutes() - wildcard routes', (t) => {
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
