'use strict'

const got = require('got').extend({
  retry: 0,
  followRedirect: false,
  throwHttpErrors: false,
})

/* eslint-disable consistent-return */

async function request(app, url, options, cb) {
  if (app.server === null || !app.server.listening) {
    await app.listen()
    app.server.unref()
  }

  if (typeof url === 'object') {
    cb = options
    options = undefined
    url.url = (url.rejectUnauthorized === false ? 'https' : 'http') +
      '://localhost:' + app.server.address().port + url.url
  } else if (typeof options === 'object') {
    url = (options.rejectUnauthorized === false ? 'https' : 'http') +
      '://localhost:' + app.server.address().port + url
  } else {
    cb = options
    options = undefined
    url = 'http://localhost:' + app.server.address().port + url
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
