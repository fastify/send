'use strict'

const { test } = require('tap')
const http = require('node:http')
const path = require('node:path')
const request = require('supertest')
const send = require('../lib/send').send
const { Readable } = require('node:stream')
const { createReadStream } = require('node:fs')

const fixtures = path.join(__dirname, 'fixtures')

test('send(file)', function (t) {
  t.plan(3)

  t.test('when "onSendDirectory" is provided', function (t) {
    t.plan(2)

    t.test('should be called when sending directory', function (t) {
      t.plan(1)
      const server = http.createServer(async function (req, res) {
        const { statusCode, headers, stream } = await send(req, req.url, { 
          root: fixtures,
          onSendDirectory
        })
        res.writeHead(statusCode, headers)
        stream.pipe(res)
      })

      function onSendDirectory () {
        return { statusCode: 400, headers: {}, stream: Readable.from('No directory for you') }
      }

      request(server)
        .get('/pets')
        .expect(400, 'No directory for you', err => t.error(err))
    })

    t.test('should be called with path', function (t) {
      t.plan(1)
      const server = http.createServer(async function (req, res) {
        const { statusCode, headers, stream } = await send(req, req.url, { 
          root: fixtures,
          onSendDirectory
        })
        res.writeHead(statusCode, headers)
        stream.pipe(res)
      })

      function onSendDirectory (dirPath) {
        return { statusCode: 200, headers: {}, stream: Readable.from(path.normalize(dirPath)) }
      }

      request(server)
        .get('/pets')
        .expect(200, path.normalize(path.join(fixtures, 'pets')), err => t.error(err))
    })
  })

  t.test('when "onSendFile" is provided', function (t) {
    t.plan(1)

    const app = http.createServer(async function (req, res) {
      const { statusCode, headers, stream } = await send(req, req.url, { 
        root: fixtures,
        onSendFile
      })
      res.writeHead(statusCode, headers)
      stream.pipe(res)
    })

    function onSendFile (filePath) {
      return { statusCode: 200, headers: {}, stream: createReadStream(filePath) }
    }

    request(app)
      .get('/name.txt')
      .expect(200, 'tobi', err => t.error(err))
  })

  t.test('when "onSendError" is provided', function (t) {
    t.plan(2)

    const app = http.createServer(async function (req, res) {
      const { statusCode, headers, stream } = await send(req, req.url, { 
        root: fixtures,
        onSendError
      })
      res.writeHead(statusCode, headers)
      stream.pipe(res)
    })

    function onSendError (statusCode, err) {
      t.equal(statusCode, 404)
      return { statusCode: 200, headers: {}, stream: Readable.from('no error') }
    }

    request(app)
      .get('/notfound')
      .expect(200, 'no error', err => t.error(err))
  })
})