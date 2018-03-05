'use strict'

const t = require('tap')
const querystring = require('querystring')
const parseQuery = require('../../lib/parseQuery')

t.test('returns an empty obect if the URL does not have a query string', (t) => {
  function qsParser() {
    t.fail('the queryParser function should not be called')
  }

  const emptyObj = Object.create(null)

  t.deepEqual(parseQuery('/', qsParser), emptyObj)
  t.deepEqual(parseQuery('/no-query', qsParser), emptyObj)
  t.deepEqual(parseQuery('https://www.site.com/', qsParser), emptyObj)
  t.deepEqual(parseQuery('/?', qsParser), emptyObj)
  t.deepEqual(parseQuery('/path#hash', qsParser), emptyObj)
  t.deepEqual(parseQuery('/path?#hash', qsParser), emptyObj)
  t.deepEqual(parseQuery('/path#hash?query=false', qsParser), emptyObj)

  t.end()
})

t.test('extracts the query string and passes it to the queryParser', (t) => {
  function qsParser(qs) {
    return qs
  }

  t.equal(parseQuery('/?query', qsParser), 'query')
  t.equal(parseQuery('https://localhost:80/?query&a=1', qsParser), 'query&a=1')
  t.equal(parseQuery('/?qu?ery', qsParser), 'qu?ery')
  t.equal(parseQuery('/??query', qsParser), '?query')
  t.equal(parseQuery('/?query?', qsParser), 'query?')
  t.equal(parseQuery('/?a&b=1%23-&c=', qsParser), 'a&b=1%23-&c=')
  t.equal(parseQuery('/?q#uery', qsParser), 'q')
  t.equal(parseQuery('/?que#ry', qsParser), 'que')
  t.equal(parseQuery('/?query#', qsParser), 'query')
  t.equal(parseQuery('http://理容ナカムラ.com/a?a=b#c', qsParser), 'a=b')

  t.end()
})

t.test('works with querystring.parse', (t) => {
  t.deepEqual(parseQuery('https://localhost:80/?query&a=1', querystring.parse), {
    query: '',
    a: '1',
  })
  t.deepEqual(parseQuery('/?qu?ery=%23', querystring.parse), {
    'qu?ery': '#',
  })
  t.deepEqual(parseQuery('/?a&b=1%23-&c=', querystring.parse), {
    a: '',
    b: '1#-',
    c: '',
  })

  t.end()
})
