'use strict'

const t = require('tap')
const medley = require('..')

t.test('.load() runs onLoad handlers in the context of the app or sub-app', (t) => {
  t.plan(3)

  const app = medley()

  app.onLoad(function(done) {
    t.equal(this, app)
    done()
  })

  const subApp = app.createSubApp()
  subApp.onLoad(function(done) {
    t.equal(this, subApp)
    done()
  })

  app.load((err) => {
    t.error(err)
  })
})

t.test('load order', (t) => {
  t.plan(4)

  const app = medley()
  let order = 1

  app.createSubApp()
    .onLoad((done) => {
      t.equal(order++, 1)
      setImmediate(done)
    })

  app.onLoad((done) => {
    t.equal(order++, 2)
    done()
  })

  app.load((err) => {
    t.error(err)
    t.equal(order++, 3)
  })
})

t.test('should pass error to the load callback and skip other onLoad handlers', (t) => {
  t.plan(2)

  const app = medley()
  const error = new Error('onLoad error')

  app.onLoad((done) => {
    t.pass('first called')
    done(error)
  })

  app.onLoad(() => {
    t.fail('second onLoad should not be called')
  })

  app.load((err) => {
    t.equal(err, error)
  })
})

t.test('should pass error to the load callback and skip other onLoad handlers (Promises)', (t) => {
  t.plan(2)

  const app = medley()
  const error = new Error('onLoad error')

  app.onLoad(() => {
    t.pass('first called')
    return Promise.reject(error)
  })

  app.onLoad(() => {
    t.fail('second onLoad should not be called')
  })

  app.load().then(
    () => t.fail('loading should fail'),
    (err) => {
      t.equal(err, error)
    }
  )
})

t.test('should create an error for promises that reject with a falsy value', (t) => {
  t.plan(3)

  const app = medley()

  app.onLoad(() => {
    t.pass('first called')
    return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
  })

  app.onLoad(() => {
    t.fail('second onLoad should not be called')
  })

  app.load().then(
    () => t.fail('loading should fail'),
    (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Promise threw non-error: null')
    }
  )
})

t.test('.onLoad() should be chainable', (t) => {
  t.plan(5)

  const app = medley()

  app
    .onLoad((done) => {
      t.pass('first called')
      done()
    })
    .onLoad((done) => {
      t.pass('second called')
      process.nextTick(done)
    })
    .onLoad(() => {
      t.pass('third called')
      return Promise.resolve()
    })
    .onLoad((done) => {
      t.pass('fourth called')
      done()
    })

  app.load((err) => {
    t.error(err)
  })
})

t.test('.load() can return a promise', (t) => {
  t.plan(2)

  const app = medley()

  app.onLoad(function(done) {
    t.equal(this, app)
    done()
  })

  app.load().then(
    () => t.pass(),
    err => t.fail(err)
  )
})

t.test('calling .load() again does not run onLoad handlers a second time', (t) => {
  t.plan(3)

  const app = medley()

  app.onLoad(function(done) {
    t.equal(this, app)
    done()
  })

  app.load((err) => {
    t.error(err)

    app.load((err) => {
      t.error(err)
    })
  })
})

t.test('.load() should only run onLoad handlers once even if called multiple times', (t) => {
  t.plan(5)

  const app = medley()

  app.onLoad((done) => {
    t.pass('onLoad handler called')
    setTimeout(done, 10)
  })

  app.onLoad((done) => {
    t.pass('onLoad handler called')
    setTimeout(done, 10)
  })

  app.load((err) => {
    t.error(err)
  })

  app.load((err) => {
    t.error(err)

    app.load((err) => {
      t.error(err, 'should not error even if .load() is called after loading completes')
    })
  })
})

t.test('.load() should only run onLoad handlers once even if called multiple times (promises)', (t) => {
  t.plan(5)

  const app = medley()

  app.onLoad((done) => {
    t.pass('onLoad handler called')
    setTimeout(done, 10)
  })

  app.onLoad((done) => {
    t.pass('onLoad handler called')
    setTimeout(done, 10)
  })

  app.load().then(
    () => t.pass('load complete'),
    err => t.fail(err)
  )

  app.load().then(
    () => {
      t.pass('load complete')

      app.load().then(
        () => t.pass('load complete'),
        err => t.fail(err, 'should not error even if .load() is called after loading completes')
      )
    },
    err => t.fail(err)
  )
})
