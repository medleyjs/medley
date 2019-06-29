'use strict'

const http = require('http')

http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    const body = 'Hello World'
    res.writeHead(200, {
      'content-length': Buffer.byteLength(body),
      'content-type': 'text/plain; charset=utf-8',
    })
    res.end(body)
  } else {
    const body = '404 Not Found'
    res.writeHead(404, {
      'content-length': Buffer.byteLength(body),
      'content-type': 'text/plain; charset=utf-8',
    })
    res.end(body)
  }
}).listen(3000, (err) => {
  if (err) {
    throw err
  }
  console.log('Server listening on port 3000') // eslint-disable-line no-console
})
