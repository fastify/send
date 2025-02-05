'use strict'

const { test } = require('node:test')
const { containsDotFile } = require('../lib/containsDotFile')

test('containsDotFile', function (t) {
  const testCases = [
    ['/.github', true],
    ['.github', true],
    ['index.html', false],
    ['./index.html', false]
  ]
  t.plan(testCases.length)

  for (const testCas of testCases) {
    t.assert.deepStrictEqual(containsDotFile(testCas[0].split('/')), testCas[1], testCas[0])
  }
})
