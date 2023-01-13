'use strict'

const http = require('http')
const send = require('..')

const server = http.createServer(function onRequest (req, res) {
  send(req, __dirname + '/index.html')
    .pipe(res)
})

server.listen(3000)
