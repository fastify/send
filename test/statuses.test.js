'use strict'

const { test } = require('tap')
const statuses = require('statuses')

test('statuses', function (t) {
  t.plan(1)

  t.test('should have uses statusCodes', function (t) {
    t.plan(6)
    t.ok(statuses(400))
    t.ok(statuses(403))
    t.ok(statuses(404))
    t.ok(statuses(412))
    t.ok(statuses(416))
    t.ok(statuses(500))
  })
})
