'use strict'

const http = require('node:http')
const send = require('..')
const path = require('node:path')

const indexPath = path.join(__dirname, 'index.html')

const server = http.createServer(function onRequest (req, res) {
  send(req, indexPath)
    .pipe(res)
})

server.listen(3000)
