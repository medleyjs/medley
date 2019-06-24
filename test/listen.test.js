'use strict'

const test = require('tap').test
const medley = require('..')

test('.listen(cb)', (t) => {
  t.plan(1)

  const app = medley()

  app.listen((err) => {
    t.error(err)
    app.close()
  })
})

test('.listen()', async () => {
  const app = medley()

  await app.listen()

  app.close()
})

test('.listen(port, cb)', (t) => {
  t.plan(1)

  const app = medley()

  app.listen(0, (err) => {
    t.error(err)
    app.close()
  })
})

test('.listen(port)', async () => {
  const app = medley()

  await app.listen(0)

  app.close()
})

test('.listen(port, host, cb)', (t) => {
  t.plan(2)

  const app = medley()

  app.listen(0, '127.0.0.1', (err) => {
    app.server.unref()
    t.error(err)
    t.equal(app.server.address().address, '127.0.0.1')
  })
})

test('.listen(port, host)', async (t) => {
  const app = medley()

  await app.listen(0, '127.0.0.1')
  app.server.unref()

  t.equal(app.server.address().address, '127.0.0.1')
})

test('.listen(port, host, backlog, cb)', (t) => {
  t.plan(2)

  const app = medley()

  app.listen(0, '127.0.0.1', 511, (err) => {
    app.server.unref()
    t.error(err)
    t.equal(app.server.address().address, '127.0.0.1')
  })
})

test('.listen(port, host, backlog)', async (t) => {
  const app = medley()

  await app.listen(0, '127.0.0.1', 511)
  app.server.unref()

  t.equal(app.server.address().address, '127.0.0.1')
})

test('.listen() throws if called while already listening', (t) => {
  t.plan(2)

  const app = medley()

  app.listen(0, (err) => {
    app.server.unref()
    t.error(err)
    t.throws(
      () => app.listen(0),
      new Error('.listen() called while server is already listening')
    )
  })
})

test('.listen() can be called multiple times before the server is listening', (t) => {
  t.plan(2)

  const app = medley()

  app.listen((err) => {
    app.server.unref()
    t.error(err)
  })

  app.listen((err) => {
    t.error(err)
  })
})

test('passes listen errors to the callback', (t) => {
  t.plan(2)

  const app = medley()

  app.listen((err) => {
    app.server.unref()
    t.error(err)

    const app2 = medley()

    app2.listen(app.server.address().port, (err) => {
      t.match(err, {name: 'Error', code: 'EADDRINUSE'})
    })
  })
})

test('rejects with listen errors', async (t) => {
  const app = medley()

  await app.listen()
  app.server.unref()

  const app2 = medley()

  await t.rejects(
    app2.listen(app.server.address().port),
    {name: 'Error', code: 'EADDRINUSE'}
  )
})

test('load error is passed to listen callback', (t) => {
  t.plan(1)

  const app = medley()
  const error = new Error('onLoad error')

  app.onLoad((done) => {
    done(error)
  })

  app.onLoad(() => {
    t.fail('second onLoad should not be called')
  })

  app.listen(0, (err) => {
    t.equal(err, error)
  })
})

test('rejects with load error', (t) => {
  t.plan(1)

  const app = medley()
  const error = new Error('onLoad error')

  app.onLoad((done) => {
    done(error)
  })

  app.onLoad(() => {
    t.fail('second onLoad should not be called')
  })

  t.rejects(app.listen(), error)
})
