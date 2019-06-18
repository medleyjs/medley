'use strict'

/* eslint-disable consistent-return */

const got = require('got').extend({
  retry: 0,
  followRedirect: false,
  throwHttpErrors: false,
})

const kListenWaiters = Symbol('request-listen-waiters')

async function waitForListen(app) {
  if (app[kListenWaiters] === undefined) {
    app[kListenWaiters] = []

    app.server.unref()

    try {
      await app.listen(0, 'localhost')

      process.nextTick(() => {
        for (const waiter of app[kListenWaiters]) {
          waiter.resolve()
        }
      })
    } catch (err) {
      process.nextTick(() => {
        for (const waiter of app[kListenWaiters]) {
          waiter.reject(err)
        }
      })

      throw err
    }
  } else {
    return new Promise((resolve, reject) => {
      app[kListenWaiters].push({resolve, reject})
    })
  }
}

async function request(app, url, options, cb) {
  if (!app.server.listening) {
    await waitForListen(app)
  }

  if (typeof url === 'object') {
    cb = options
    options = undefined
    url.baseUrl = (url.rejectUnauthorized === false ? 'https' : 'http') +
      '://localhost:' + app.server.address().port
  } else if (typeof options === 'object') {
    options.baseUrl = (options.rejectUnauthorized === false ? 'https' : 'http') +
      '://localhost:' + app.server.address().port
  } else {
    cb = options
    options = {baseUrl: 'http://localhost:' + app.server.address().port}
  }

  if (cb === undefined) {
    return got(url, options)
  }

  let res = null

  try {
    res = await got(url, options)
  } catch (err) {
    cb(err)
    return
  }

  cb(null, res)
}

module.exports = request
