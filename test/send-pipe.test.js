'use strict'

process.env.NO_DEPRECATION = 'send'

const { test } = require('tap')
var after = require('after')
var fs = require('fs')
var http = require('http')
var path = require('path')
var request = require('supertest')
var send = require('..')
const { shouldNotHaveBody, createServer, shouldNotHaveHeader } = require('./utils')

var dateRegExp = /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/
var fixtures = path.join(__dirname, 'fixtures')

test('send(file).pipe(res)', function (t) {
  t.plan(32)

  t.test('should stream the file contents', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect('Content-Length', '4')
      .expect(200, 'tobi', () => t.pass())
  })

  t.test('should stream a zero-length file', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/empty.txt')
      .expect('Content-Length', '0')
      .expect(200, '', () => t.pass())
  })

  t.test('should decode the given path as a URI', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/some%20thing.txt')
      .expect(200, 'hey', () => t.pass())
  })

  t.test('should serve files with dots in name', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/do..ts.txt')
      .expect(200, '...', () => t.pass())
  })

  t.test('should treat a malformed URI as a bad request', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/some%99thing.txt')
      .expect(400, 'Bad Request', () => t.pass())
  })

  t.test('should 400 on NULL bytes', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/some%00thing.txt')
      .expect(400, 'Bad Request', () => t.pass())
  })

  t.test('should treat an ENAMETOOLONG as a 404', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    var path = Array(100).join('foobar')
    request(app)
      .get('/' + path)
      .expect(404, () => t.pass())
  })

  t.test('should handle headers already sent error', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      res.write('0')
      send(req, req.url, { root: fixtures })
        .on('error', function (err) { res.end(' - ' + err.message) })
        .pipe(res)
    })
    request(app)
      .get('/name.txt')
      .expect(200, '0 - Can\'t set headers after they are sent.', () => t.pass())
  })

  t.test('should support HEAD', function (t) {
    t.plan(2)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .head('/name.txt')
      .expect(200)
      .expect('Content-Length', '4')
      .expect(shouldNotHaveBody(t))
      .end(() => t.pass())
  })

  t.test('should add an ETag header field', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect('etag', /^W\/"[^"]+"$/)
      .end(() => t.pass())
  })

  t.test('should add a Date header field', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect('date', dateRegExp, () => t.pass())
  })

  t.test('should add a Last-Modified header field', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect('last-modified', dateRegExp, () => t.pass())
  })

  t.test('should add a Accept-Ranges header field', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect('Accept-Ranges', 'bytes', () => t.pass())
  })

  t.test('should 404 if the file does not exist', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/meow')
      .expect(404, 'Not Found', () => t.pass())
  })

  t.test('should emit ENOENT if the file does not exist', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      send(req, req.url, { root: fixtures })
        .on('error', function (err) { res.end(err.statusCode + ' ' + err.code) })
        .pipe(res)
    })

    request(app)
      .get('/meow')
      .expect(200, '404 ENOENT', () => t.pass())
  })

  t.test('should not override content-type', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      res.setHeader('Content-Type', 'application/x-custom')
      send(req, req.url, { root: fixtures }).pipe(res)
    })
    request(app)
      .get('/name.txt')
      .expect('Content-Type', 'application/x-custom', () => t.pass())
  })

  t.test('should set Content-Type via mime map', function (t) {
    t.plan(2)

    var app = http.createServer(function (req, res) {
      function error (err) {
        res.statusCode = err.status
        res.end(http.STATUS_CODES[err.status])
      }

      send(req, req.url, { root: fixtures })
        .on('error', error)
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect('Content-Type', 'text/plain; charset=UTF-8')
      .expect(200, function (err) {
        t.error(err)
        request(app)
          .get('/tobi.html')
          .expect('Content-Type', 'text/html; charset=UTF-8')
          .expect(200, () => t.pass())
      })
  })

  t.test('should 404 if file disappears after stat, before open', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      send(req, req.url, { root: 'test/fixtures' })
        .on('file', function () {
          // simulate file ENOENT after on open, after stat
          var fn = this.send
          this.send = function (path, stat) {
            fn.call(this, (path + '__xxx_no_exist'), stat)
          }
        })
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect(404, () => t.pass())
  })

  t.test('should 500 on file stream error', function (t) {
    t.plan(1)

    var app = http.createServer(function (req, res) {
      send(req, req.url, { root: 'test/fixtures' })
        .on('stream', function (stream) {
          // simulate file error
          stream.on('open', function () {
            stream.emit('error', new Error('boom!'))
          })
        })
        .pipe(res)
    })

    request(app)
      .get('/name.txt')
      .expect(500, () => t.pass())
  })

  t.test('"headers" event', function (t) {
    t.plan(7)
    t.test('should fire when sending file', function (t) {
      t.plan(1)
      var cb = after(2, () => t.pass())
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', function () { cb() })
          .pipe(res)
      })

      request(server)
        .get('/name.txt')
        .expect(200, 'tobi', cb)
    })

    t.test('should not fire on 404', function (t) {
      t.plan(1)
      var cb = after(1, () => t.pass())
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', function () { cb() })
          .pipe(res)
      })

      request(server)
        .get('/bogus')
        .expect(404, cb)
    })

    t.test('should fire on index', function (t) {
      t.plan(1)
      var cb = after(2, () => t.pass())
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', function () { cb() })
          .pipe(res)
      })

      request(server)
        .get('/pets/')
        .expect(200, /tobi/, cb)
    })

    t.test('should not fire on redirect', function (t) {
      t.plan(1)
      var cb = after(1, () => t.pass())
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', function () { cb() })
          .pipe(res)
      })

      request(server)
        .get('/pets')
        .expect(301, cb)
    })

    t.test('should provide path', function (t) {
      t.plan(3)
      var cb = after(2, () => t.pass())
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', onHeaders)
          .pipe(res)
      })

      function onHeaders (res, filePath) {
        t.ok(filePath)
        t.strictSame(path.normalize(filePath), path.normalize(path.join(fixtures, 'name.txt')))
        cb()
      }

      request(server)
        .get('/name.txt')
        .expect(200, 'tobi', cb)
    })

    t.test('should provide stat', function (t) {
      t.plan(4)
      var cb = after(2, () => t.pass())
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', onHeaders)
          .pipe(res)
      })

      function onHeaders (res, path, stat) {
        t.ok(stat)
        t.ok('ctime' in stat)
        t.ok('mtime' in stat)
        cb()
      }

      request(server)
        .get('/name.txt')
        .expect(200, 'tobi', cb)
    })

    t.test('should allow altering headers', function (t) {
      t.plan(1)
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('headers', onHeaders)
          .pipe(res)
      })

      function onHeaders (res, path, stat) {
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Content-Type', 'text/x-custom')
        res.setHeader('ETag', 'W/"everything"')
        res.setHeader('X-Created', stat.ctime.toUTCString())
      }

      request(server)
        .get('/name.txt')
        .expect(200)
        .expect('Cache-Control', 'no-cache')
        .expect('Content-Type', 'text/x-custom')
        .expect('ETag', 'W/"everything"')
        .expect('X-Created', dateRegExp)
        .expect('tobi')
        .end(() => t.pass())
    })
  })

  t.test('when "directory" listeners are present', function (t) {
    t.plan(2)

    t.test('should be called when sending directory', function (t) {
      t.plan(1)
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('directory', onDirectory)
          .pipe(res)
      })

      function onDirectory (res) {
        res.statusCode = 400
        res.end('No directory for you')
      }

      request(server)
        .get('/pets')
        .expect(400, 'No directory for you', () => t.pass())
    })

    t.test('should be called with path', function (t) {
      t.plan(1)
      var server = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .on('directory', onDirectory)
          .pipe(res)
      })

      function onDirectory (res, dirPath) {
        res.end(path.normalize(dirPath))
      }

      request(server)
        .get('/pets')
        .expect(200, path.normalize(path.join(fixtures, 'pets')), () => t.pass())
    })
  })

  t.test('when no "directory" listeners are present', function (t) {
    t.plan(5)

    t.test('should redirect directories to trailing slash', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures }))
        .get('/pets')
        .expect('Location', '/pets/')
        .expect(301, () => t.pass())
    })

    t.test('should respond with an HTML redirect', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures }))
        .get('/pets')
        .expect('Location', '/pets/')
        .expect('Content-Type', /html/)
        .expect(301, />Redirecting to <a href="\/pets\/">\/pets\/<\/a></, () => t.pass())
    })

    t.test('should respond with default Content-Security-Policy', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures }))
        .get('/pets')
        .expect('Location', '/pets/')
        .expect('Content-Security-Policy', "default-src 'none'")
        .expect(301, () => t.pass())
    })

    t.test('should not redirect to protocol-relative locations', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures }))
        .get('//pets')
        .expect('Location', '/pets/')
        .expect(301, () => t.pass())
    })

    t.test('should respond with an HTML redirect', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url.replace('/snow', '/snow ☃'), { root: 'test/fixtures' })
          .pipe(res)
      })

      request(app)
        .get('/snow')
        .expect('Location', '/snow%20%E2%98%83/')
        .expect('Content-Type', /html/)
        .expect(301, />Redirecting to <a href="\/snow%20%E2%98%83\/">\/snow%20%E2%98%83\/<\/a></, () => t.pass())
    })
  })

  t.test('when no "error" listeners are present', function (t) {
    t.plan(3)

    t.test('should respond to errors directly', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures }))
        .get('/foobar')
        .expect(404, />Not Found</, () => t.pass())
    })

    t.test('should respond with default Content-Security-Policy', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures }))
        .get('/foobar')
        .expect('Content-Security-Policy', "default-src 'none'")
        .expect(404, () => t.pass())
    })

    t.test('should remove all previously-set headers', function (t) {
      t.plan(2)

      var server = createServer({ root: fixtures }, function (req, res) {
        res.setHeader('X-Foo', 'bar')
      })

      request(server)
        .get('/foobar')
        .expect(shouldNotHaveHeader('X-Foo', t))
        .expect(404, () => t.pass())
    })
  })

  t.test('with conditional-GET', function (t) {
    t.plan(6)

    t.test('should remove Content headers with 304', function (t) {
      t.plan(5)

      var server = createServer({ root: fixtures }, function (req, res) {
        res.setHeader('Content-Language', 'en-US')
        res.setHeader('Content-Location', 'http://localhost/name.txt')
        res.setHeader('Contents', 'foo')
      })

      request(server)
        .get('/name.txt')
        .expect(200, function (err, res) {
          t.error(err)
          request(server)
            .get('/name.txt')
            .set('If-None-Match', res.headers.etag)
            .expect(shouldNotHaveHeader('Content-Language', t))
            .expect(shouldNotHaveHeader('Content-Length', t))
            .expect(shouldNotHaveHeader('Content-Type', t))
            .expect('Content-Location', 'http://localhost/name.txt')
            .expect('Contents', 'foo')
            .expect(304, () => t.pass())
        })
    })

    t.test('should not remove all Content-* headers', function (t) {
      t.plan(4)

      var server = createServer({ root: fixtures }, function (req, res) {
        res.setHeader('Content-Location', 'http://localhost/name.txt')
        res.setHeader('Content-Security-Policy', 'default-src \'self\'')
      })

      request(server)
        .get('/name.txt')
        .expect(200, function (err, res) {
          t.error(err)
          request(server)
            .get('/name.txt')
            .set('If-None-Match', res.headers.etag)
            .expect(shouldNotHaveHeader('Content-Length', t))
            .expect(shouldNotHaveHeader('Content-Type', t))
            .expect('Content-Location', 'http://localhost/name.txt')
            .expect('Content-Security-Policy', 'default-src \'self\'')
            .expect(304, () => t.pass())
        })
    })

    t.test('where "If-Match" is set', function (t) {
      t.plan(3)

      t.test('should respond with 200 when "*"', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .set('If-Match', '*')
          .expect(200, () => t.pass())
      })

      t.test('should respond with 412 when ETag unmatched', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .set('If-Match', ' "foo",, "bar" ,')
          .expect(412, () => t.pass())
      })

      t.test('should respond with 200 when ETag matched', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            request(app)
              .get('/name.txt')
              .set('If-Match', '"foo", "bar", ' + res.headers.etag)
              .expect(200, () => t.pass())
          })
      })
    })

    t.test('where "If-Modified-Since" is set', function (t) {
      t.plan(2)

      t.test('should respond with 304 when unmodified', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            request(app)
              .get('/name.txt')
              .set('If-Modified-Since', res.headers['last-modified'])
              .expect(304, () => t.pass())
          })
      })

      t.test('should respond with 200 when modified', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            var lmod = new Date(res.headers['last-modified'])
            var date = new Date(lmod - 60000)
            request(app)
              .get('/name.txt')
              .set('If-Modified-Since', date.toUTCString())
              .expect(200, 'tobi', () => t.pass())
          })
      })
    })

    t.test('where "If-None-Match" is set', function (t) {
      t.plan(2)

      t.test('should respond with 304 when ETag matched', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            request(app)
              .get('/name.txt')
              .set('If-None-Match', res.headers.etag)
              .expect(304, () => t.pass())
          })
      })

      t.test('should respond with 200 when ETag unmatched', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            request(app)
              .get('/name.txt')
              .set('If-None-Match', '"123"')
              .expect(200, 'tobi', () => t.pass())
          })
      })
    })

    t.test('where "If-Unmodified-Since" is set', function (t) {
      t.plan(3)

      t.test('should respond with 200 when unmodified', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            request(app)
              .get('/name.txt')
              .set('If-Unmodified-Since', res.headers['last-modified'])
              .expect(200, () => t.pass())
          })
      })

      t.test('should respond with 412 when modified', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .expect(200, function (err, res) {
            t.error(err)
            var lmod = new Date(res.headers['last-modified'])
            var date = new Date(lmod - 60000).toUTCString()
            request(app)
              .get('/name.txt')
              .set('If-Unmodified-Since', date)
              .expect(412, () => t.pass())
          })
      })

      t.test('should respond with 200 when invalid date', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/name.txt')
          .set('If-Unmodified-Since', 'foo')
          .expect(200, () => t.pass())
      })
    })
  })

  t.test('with Range request', function (t) {
    t.plan(13)

    t.test('should support byte ranges', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=0-4')
        .expect(206, '12345', () => t.pass())
    })

    t.test('should ignore non-byte ranges', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'items=0-4')
        .expect(200, '123456789', () => t.pass())
    })

    t.test('should be inclusive', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=0-0')
        .expect(206, '1', () => t.pass())
    })

    t.test('should set Content-Range', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=2-5')
        .expect('Content-Range', 'bytes 2-5/9')
        .expect(206, () => t.pass())
    })

    t.test('should support -n', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=-3')
        .expect(206, '789', () => t.pass())
    })

    t.test('should support n-', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=3-')
        .expect(206, '456789', () => t.pass())
    })

    t.test('should respond with 206 "Partial Content"', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=0-4')
        .expect(206, () => t.pass())
    })

    t.test('should set Content-Length to the # of octets transferred', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        function error (err) {
          res.statusCode = err.status
          res.end(http.STATUS_CODES[err.status])
        }

        send(req, req.url, { root: fixtures })
          .on('error', error)
          .pipe(res)
      })

      request(app)
        .get('/nums.txt')
        .set('Range', 'bytes=2-3')
        .expect('Content-Length', '2')
        .expect(206, '34', () => t.pass())
    })

    t.test('when last-byte-pos of the range is greater the length', function (t) {
      t.plan(2)

      t.test('is taken to be equal to one less than the length', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('Range', 'bytes=2-50')
          .expect('Content-Range', 'bytes 2-8/9')
          .expect(206, () => t.pass())
      })

      t.test('should adapt the Content-Length accordingly', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('Range', 'bytes=2-50')
          .expect('Content-Length', '7')
          .expect(206, () => t.pass())
      })
    })

    t.test('when the first- byte-pos of the range is greater length', function (t) {
      t.plan(2)

      t.test('should respond with 416', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('Range', 'bytes=9-50')
          .expect('Content-Range', 'bytes */9')
          .expect(416, () => t.pass())
      })

      t.test('should emit error 416 with content-range header', function (t) {
        t.plan(1)

        var server = http.createServer(function (req, res) {
          send(req, req.url, { root: fixtures })
            .on('error', function (err) {
              res.setHeader('X-Content-Range', err.headers['Content-Range'])
              res.statusCode = err.statusCode
              res.end(err.message)
            })
            .pipe(res)
        })

        request(server)
          .get('/nums.txt')
          .set('Range', 'bytes=9-50')
          .expect('X-Content-Range', 'bytes */9')
          .expect(416, () => t.pass())
      })
    })

    t.test('when syntactically invalid', function (t) {
      t.plan(1)

      t.test('should respond with 200 and the entire contents', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('Range', 'asdf')
          .expect(200, '123456789', () => t.pass())
      })
    })

    t.test('when multiple ranges', function (t) {
      t.plan(2)

      t.test('should respond with 200 and the entire contents', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('Range', 'bytes=1-1,3-')
          .expect(shouldNotHaveHeader('Content-Range', t))
          .expect(200, '123456789', () => t.pass())
      })

      t.test('should respond with 206 is all ranges can be combined', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('Range', 'bytes=1-2,3-5')
          .expect('Content-Range', 'bytes 1-5/9')
          .expect(206, '23456', () => t.pass())
      })
    })

    t.test('when if-range present', function (t) {
      t.plan(5)

      t.test('should respond with parts when etag unchanged', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .expect(200, function (err, res) {
            t.error(err)
            var etag = res.headers.etag

            request(app)
              .get('/nums.txt')
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .expect(206, '1', () => t.pass())
          })
      })

      t.test('should respond with 200 when etag changed', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .expect(200, function (err, res) {
            t.error(err)
            var etag = res.headers.etag.replace(/"(.)/, '"0$1')

            request(app)
              .get('/nums.txt')
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .expect(200, '123456789', () => t.pass())
          })
      })

      t.test('should respond with parts when modified unchanged', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .expect(200, function (err, res) {
            t.error(err)
            var modified = res.headers['last-modified']

            request(app)
              .get('/nums.txt')
              .set('If-Range', modified)
              .set('Range', 'bytes=0-0')
              .expect(206, '1', () => t.pass())
          })
      })

      t.test('should respond with 200 when modified changed', function (t) {
        t.plan(2)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .expect(200, function (err, res) {
            t.error(err)
            var modified = Date.parse(res.headers['last-modified']) - 20000

            request(app)
              .get('/nums.txt')
              .set('If-Range', new Date(modified).toUTCString())
              .set('Range', 'bytes=0-0')
              .expect(200, '123456789', () => t.pass())
          })
      })

      t.test('should respond with 200 when invalid value', function (t) {
        t.plan(1)

        var app = http.createServer(function (req, res) {
          function error (err) {
            res.statusCode = err.status
            res.end(http.STATUS_CODES[err.status])
          }

          send(req, req.url, { root: fixtures })
            .on('error', error)
            .pipe(res)
        })

        request(app)
          .get('/nums.txt')
          .set('If-Range', 'foo')
          .set('Range', 'bytes=0-0')
          .expect(200, '123456789', () => t.pass())
      })
    })
  })

  t.test('when "options" is specified', function (t) {
    t.plan(4)

    t.test('should support start/end', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures, start: 3, end: 5 }))
        .get('/nums.txt')
        .expect(200, '456', () => t.pass())
    })

    t.test('should adjust too large end', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures, start: 3, end: 90 }))
        .get('/nums.txt')
        .expect(200, '456789', () => t.pass())
    })

    t.test('should support start/end with Range request', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures, start: 0, end: 2 }))
        .get('/nums.txt')
        .set('Range', 'bytes=-2')
        .expect(206, '23', () => t.pass())
    })

    t.test('should support start/end with unsatisfiable Range request', function (t) {
      t.plan(1)

      request(createServer({ root: fixtures, start: 0, end: 2 }))
        .get('/nums.txt')
        .set('Range', 'bytes=5-9')
        .expect('Content-Range', 'bytes */3')
        .expect(416, () => t.pass())
    })
  })

  t.test('.etag()', function (t) {
    t.plan(1)

    t.test('should support disabling etags', function (t) {
      t.plan(2)

      var app = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .etag(false)
          .pipe(res)
      })

      request(app)
        .get('/name.txt')
        .expect(shouldNotHaveHeader('ETag', t))
        .expect(200, () => t.pass())
    })
  })

  t.test('.from()', function (t) {
    t.plan(1)

    t.test('should set with deprecated from', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url)
          .from(fixtures)
          .pipe(res)
      })

      request(app)
        .get('/pets/../name.txt')
        .expect(200, 'tobi', () => t.pass())
    })
  })

  t.test('.hidden()', function (t) {
    t.plan(1)

    t.test('should default support sending hidden files', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .hidden(true)
          .pipe(res)
      })

      request(app)
        .get('/.hidden.txt')
        .expect(200, 'secret', () => t.pass())
    })
  })

  t.test('.index()', function (t) {
    t.plan(3)

    t.test('should be configurable', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .index('tobi.html')
          .pipe(res)
      })

      request(app)
        .get('/')
        .expect(200, '<p>tobi</p>', () => t.pass())
    })

    t.test('should support disabling', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .index(false)
          .pipe(res)
      })

      request(app)
        .get('/pets/')
        .expect(403, () => t.pass())
    })

    t.test('should support fallbacks', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url, { root: fixtures })
          .index(['default.htm', 'index.html'])
          .pipe(res)
      })

      request(app)
        .get('/pets/')
        .expect(200, fs.readFileSync(path.join(fixtures, 'pets', 'index.html'), 'utf8'), () => t.pass())
    })
  })

  t.test('.maxage()', function (t) {
    t.plan(4)

    t.test('should default to 0', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, 'test/fixtures/name.txt')
          .maxage(undefined)
          .pipe(res)
      })

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=0', () => t.pass())
    })

    t.test('should floor to integer', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, 'test/fixtures/name.txt')
          .maxage(1234)
          .pipe(res)
      })

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=1', () => t.pass())
    })

    t.test('should accept string', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, 'test/fixtures/name.txt')
          .maxage('30d')
          .pipe(res)
      })

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=2592000', () => t.pass())
    })

    t.test('should max at 1 year', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, 'test/fixtures/name.txt')
          .maxage(Infinity)
          .pipe(res)
      })

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=31536000', () => t.pass())
    })
  })

  t.test('.root()', function (t) {
    t.plan(1)

    t.test('should set root', function (t) {
      t.plan(1)

      var app = http.createServer(function (req, res) {
        send(req, req.url)
          .root(fixtures)
          .pipe(res)
      })

      request(app)
        .get('/pets/../name.txt')
        .expect(200, 'tobi', () => t.pass())
    })
  })
})
