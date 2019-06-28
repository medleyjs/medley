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
