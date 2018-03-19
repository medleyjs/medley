'use strict'

const os = require('os')
const path = require('path')
const fs = require('fs')
const test = require('tap').test
const medley = require('..')

test('listen accepts a port and a callback', (t) => {
  t.plan(3)
  const app = medley()
  app.listen(0, (err) => {
    app.server.unref()
    t.is(app.server.address().address, '127.0.0.1')
    t.error(err)
    t.pass()
    app.close()
  })
})

test('listen accepts a port, address, and callback', (t) => {
  t.plan(2)
  const app = medley()
  app.listen(0, '127.0.0.1', (err) => {
    app.server.unref()
    t.error(err)
    t.pass()
    app.close()
  })
})

test('listen accepts a port, address, backlog and callback', (t) => {
  t.plan(2)
  const app = medley()
  app.listen(0, '127.0.0.1', 511, (err) => {
    app.server.unref()
    t.error(err)
    t.pass()
    app.close()
  })
})

test('listen after Promise.resolve()', (t) => {
  t.plan(2)
  const f = medley()
  Promise.resolve()
    .then(() => {
      f.listen(0, (err) => {
        f.server.unref()
        t.error(err)
        t.pass()
        f.close()
      })
    })
})

test('double listen errors', (t) => {
  t.plan(2)
  const app = medley()
  app.listen(0, (err) => {
    t.error(err)
    app.listen(app.server.address().port, (err) => {
      t.ok(err)
      app.close()
    })
  })
})

test('listen twice on the same port', (t) => {
  t.plan(2)
  const app = medley()
  app.listen(0, (err) => {
    t.error(err)
    const s2 = medley()
    s2.listen(app.server.address().port, (err) => {
      app.close()
      t.ok(err)
    })
  })
})

// https://nodejs.org/api/net.html#net_ipc_support
test('listen on socket', (t) => {
  t.plan(2)

  const app = medley()
  const sockFile = os.platform() === 'win32'
    ? path.join('\\\\?\\pipe', process.cwd(), 'medley-pipe')
    : path.join(os.tmpdir(), 'server.sock')

  try {
    fs.unlinkSync(sockFile)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      t.fail(err)
    }
  }

  app.listen(sockFile, (err) => {
    t.error(err)
    t.equal(sockFile, app.server.address())
    app.close()
  })
})

test('listen without callback', (t) => {
  t.plan(1)
  const app = medley()
  app.listen(0)
    .then(() => {
      t.is(app.server.address().address, '127.0.0.1')
      app.close()
      t.end()
    })
})

test('double listen without callback rejects', (t) => {
  t.plan(1)
  const app = medley()
  app.listen(0)
    .then(() => {
      app.listen(0)
        .then(() => {
          t.error(new Error('second call to app.listen resolved'))
          app.close()
        })
        .catch((err) => {
          t.ok(err)
          app.close()
        })
    })
    .catch(err => t.error(err))
})

test('listen twice on the same port without callback rejects', (t) => {
  t.plan(1)
  const app = medley()

  app.listen(0)
    .then(() => {
      const s2 = medley()
      s2.listen(app.server.address().port)
        .then(() => {
          t.error(new Error('listen on port already in use resolved'))
          app.close()
          s2.close()
        })
        .catch((err) => {
          t.ok(err)
          app.close()
          s2.close()
        })
    })
    .catch(err => t.error(err))
})
