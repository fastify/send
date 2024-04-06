/*!
 * send
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2014-2022 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const Stream = require('node:stream')
const debug = require('node:util').debuglog('send')

const decode = require('fast-decode-uri-component')
const escapeHtml = require('escape-html')
const mime = require('mime')
const ms = require('@lukeed/ms')

const { clearHeaders } = require('./clearHeaders')
const { collapseLeadingSlashes } = require('./collapseLeadingSlashes')
const { containsDotFile } = require('./containsDotFile')
const { contentRange } = require('./contentRange')
const { createHtmlDocument } = require('./createHtmlDocument')
const { createHttpError } = require('./createHttpError')
const { isUtf8MimeType } = require('./isUtf8MimeType')
const { normalizeList } = require('./normalizeList')
const { parseBytesRange } = require('./parseBytesRange')
const { parseTokenList } = require('./parseTokenList')
const { setHeaders } = require('./setHeaders')

/**
 * Path function references.
 * @private
 */

const extname = path.extname
const join = path.join
const normalize = path.normalize
const resolve = path.resolve
const sep = path.sep

/**
 * Regular expression for identifying a bytes Range header.
 * @private
 */

const BYTES_RANGE_REGEXP = /^ *bytes=/

/**
 * Maximum value allowed for the max age.
 * @private
 */

const MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000 // 1 year

/**
 * Regular expression to match a path with a directory up component.
 * @private
 */

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/

const ERROR_RESPONSES = {
  400: createHtmlDocument('Error', 'Bad Request'),
  403: createHtmlDocument('Error', 'Forbidden'),
  404: createHtmlDocument('Error', 'Not Found'),
  412: createHtmlDocument('Error', 'Precondition Failed'),
  416: createHtmlDocument('Error', 'Range Not Satisfiable'),
  500: createHtmlDocument('Error', 'Internal Server Error')
}

const validDotFilesOptions = [
  'allow',
  'ignore',
  'deny'
]

/**
 * Initialize a `SendStream` with the given `path`.
 *
 * @param {Request} req
 * @param {String} path
 * @param {object} [options]
 * @private
 */

class SendStream extends Stream {
  constructor (req, path, options = {}) {
    super()

    this.options = options
    this.path = path
    this.req = req

    this._acceptRanges = options.acceptRanges !== undefined
      ? Boolean(options.acceptRanges)
      : true

    this._cacheControl = options.cacheControl !== undefined
      ? Boolean(options.cacheControl)
      : true

    this._etag = options.etag !== undefined
      ? Boolean(options.etag)
      : true

    this._dotfiles = options.dotfiles !== undefined
      ? validDotFilesOptions.indexOf(options.dotfiles)
      : 1 // 'ignore'

    if (this._dotfiles === -1) {
      throw new TypeError('dotfiles option must be "allow", "deny", or "ignore"')
    }

    this._extensions = options.extensions !== undefined
      ? normalizeList(options.extensions, 'extensions option')
      : []

    this._immutable = options.immutable !== undefined
      ? Boolean(options.immutable)
      : false

    this._index = options.index !== undefined
      ? normalizeList(options.index, 'index option')
      : ['index.html']

    this._lastModified = options.lastModified !== undefined
      ? Boolean(options.lastModified)
      : true

    const untypedMaxage = options.maxAge ?? options.maxage
    const uncheckedMaxage = typeof untypedMaxage === 'string'
      ? ms.parse(untypedMaxage)
      : Number(untypedMaxage)
    // eslint-disable-next-line no-self-compare
    this._maxage = uncheckedMaxage === uncheckedMaxage // fast path of isNaN(number)
      ? Math.min(Math.max(0, uncheckedMaxage), MAX_MAXAGE)
      : 0

    this._root = options.root
      ? resolve(options.root)
      : null
  }

  /**
   * Set root `path`.
   *
   * @param {String} path
   * @return {SendStream}
   * @api private
   */

  root (path) {
    this._root = resolve(String(path))
    debug('root %s', this._root)
    return this
  }

  /**
   * Emit error with `status`.
   *
   * @memberof SendStream
   * @param {number} status
   * @param {Error} [err]
   * @this {Stream}
   * @private
   */

  error (status, err) {
    // emit if listeners instead of responding
    if (this.listenerCount('error') > 0) {
      return this.emit('error', createHttpError(status, err))
    }

    const res = this.res

    // clear existing headers
    clearHeaders(res)

    // add error headers
    if (err && err.headers) {
      setHeaders(res, err.headers)
    }

    const doc = ERROR_RESPONSES[status]

    // send basic response
    res.statusCode = status
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.setHeader('Content-Length', doc[1])
    res.setHeader('Content-Security-Policy', "default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(doc[0])
  }

  /**
   * Check if the pathname ends with "/".
   *
   * @return {boolean}
   * @private
   */

  hasTrailingSlash () {
    return this.path[this.path.length - 1] === '/'
  }

  /**
   * Check if this is a conditional GET request.
   *
   * @return {Boolean}
   * @api private
   */

  isConditionalGET () {
    return this.req.headers['if-match'] ??
      this.req.headers['if-unmodified-since'] ??
      this.req.headers['if-none-match'] ??
      this.req.headers['if-modified-since']
  }

  isNotModifiedFailure () {
    const req = this.req
    const res = this.res

    // Always return stale when Cache-Control: no-cache
    // to support end-to-end reload requests
    // https://tools.ietf.org/html/rfc2616#section-14.9.4
    if (
      'cache-control' in req.headers &&
      req.headers['cache-control'].indexOf('no-cache') !== -1
    ) {
      return false
    }

    // if-none-match
    if ('if-none-match' in req.headers) {
      const ifNoneMatch = req.headers['if-none-match']

      if (ifNoneMatch === '*') {
        return true
      }

      const etag = res.getHeader('etag')

      if (typeof etag !== 'string') {
        return false
      }

      const etagL = etag.length
      const isMatching = parseTokenList(ifNoneMatch, function (match) {
        const mL = match.length

        if (
          (etagL === mL && match === etag) ||
          (etagL > mL && 'W/' + match === etag)
        ) {
          return true
        }
      })

      if (isMatching) {
        return true
      }

      /**
       * A recipient MUST ignore If-Modified-Since if the request contains an
       * If-None-Match header field; the condition in If-None-Match is considered
       * to be a more accurate replacement for the condition in If-Modified-Since,
       * and the two are only combined for the sake of interoperating with older
       * intermediaries that might not implement If-None-Match.
       *
       * @see RFC 9110 section 13.1.3
       */
      return false
    }

    // if-modified-since
    if ('if-modified-since' in req.headers) {
      const ifModifiedSince = req.headers['if-modified-since']
      const lastModified = res.getHeader('last-modified')

      if (!lastModified || (Date.parse(lastModified) <= Date.parse(ifModifiedSince))) {
        return true
      }
    }

    return false
  }

  /**
   * Check if the request preconditions failed.
   *
   * @return {boolean}
   * @private
   */

  isPreconditionFailure () {
    const req = this.req
    const res = this.res

    // if-match
    const ifMatch = req.headers['if-match']
    if (ifMatch) {
      const etag = res.getHeader('ETag')

      if (ifMatch !== '*') {
        const isMatching = parseTokenList(ifMatch, function (match) {
          if (
            match === etag ||
            'W/' + match === etag
          ) {
            return true
          }
        })

        if (isMatching !== true) {
          return true
        }
      }
    }

    // if-unmodified-since
    if ('if-unmodified-since' in req.headers) {
      const ifUnmodifiedSince = req.headers['if-unmodified-since']
      const unmodifiedSince = Date.parse(ifUnmodifiedSince)
      // eslint-disable-next-line no-self-compare
      if (unmodifiedSince === unmodifiedSince) { // fast path of isNaN(number)
        const lastModified = Date.parse(res.getHeader('Last-Modified'))
        if (
          // eslint-disable-next-line no-self-compare
          lastModified !== lastModified || // fast path of isNaN(number)
          lastModified > unmodifiedSince
        ) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Strip various content header fields for a change in entity.
   *
   * @private
   */

  removeContentHeaderFields () {
    const res = this.res

    res.removeHeader('Content-Encoding')
    res.removeHeader('Content-Language')
    res.removeHeader('Content-Length')
    res.removeHeader('Content-Range')
    res.removeHeader('Content-Type')
  }

  /**
   * Respond with 304 not modified.
   *
   * @api private
   */

  notModified () {
    const res = this.res
    debug('not modified')
    this.removeContentHeaderFields()
    res.statusCode = 304
    res.end()
  }

  /**
   * Raise error that headers already sent.
   *
   * @api private
   */

  headersAlreadySent () {
    const err = new Error('Can\'t set headers after they are sent.')
    debug('headers already sent')
    this.error(500, err)
  }

  /**
   * Check if the request is cacheable, aka
   * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
   *
   * @return {Boolean}
   * @api private
   */

  isCachable () {
    const statusCode = this.res.statusCode
    return (statusCode >= 200 && statusCode < 300) ||
      statusCode === 304
  }

  /**
   * Handle stat() error.
   *
   * @param {Error} error
   * @private
   */

  onStatError (error) {
    // POSIX throws ENAMETOOLONG and ENOTDIR, Windows only ENOENT
    /* istanbul ignore next */
    switch (error.code) {
      case 'ENAMETOOLONG':
      case 'ENOTDIR':
      case 'ENOENT':
        this.error(404, error)
        break
      default:
        this.error(500, error)
        break
    }
  }

  /**
   * Check if the range is fresh.
   *
   * @return {Boolean}
   * @api private
   */

  isRangeFresh () {
    if (!('if-range' in this.req.headers)) {
      return true
    }

    const ifRange = this.req.headers['if-range']

    // if-range as etag
    if (ifRange.indexOf('"') !== -1) {
      const etag = this.res.getHeader('ETag')
      return (etag && ifRange.indexOf(etag) !== -1)
    }

    const ifRangeTimestamp = Date.parse(ifRange)
    // eslint-disable-next-line no-self-compare
    if (ifRangeTimestamp !== ifRangeTimestamp) { // fast path of isNaN(number)
      return false
    }

    // if-range as modified date
    const lastModified = Date.parse(this.res.getHeader('Last-Modified'))

    return (
      // eslint-disable-next-line no-self-compare
      lastModified !== lastModified || // fast path of isNaN(number)
      lastModified <= ifRangeTimestamp
    )
  }

  /**
   * Redirect to path.
   *
   * @param {string} path
   * @private
   */

  redirect (path) {
    const res = this.res

    if (this.listenerCount('directory') > 0) {
      this.emit('directory', res, path)
      return
    }

    if (this.hasTrailingSlash()) {
      this.error(403)
      return
    }

    const loc = encodeURI(collapseLeadingSlashes(this.path + '/'))
    const doc = createHtmlDocument('Redirecting', 'Redirecting to <a href="' + escapeHtml(loc) + '">' +
      escapeHtml(loc) + '</a>')

    // redirect
    res.statusCode = 301
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.setHeader('Content-Length', doc[1])
    res.setHeader('Content-Security-Policy', "default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Location', loc)
    res.end(doc[0])
  }

  /**
   * Pipe to `res.
   *
   * @param {Stream} res
   * @return {Stream} res
   * @api public
   */

  pipe (res) {
    // root path
    const root = this._root

    // references
    this.res = res

    // decode the path
    let path = decode(this.path)
    if (path === null) {
      this.error(400)
      return res
    }

    // null byte(s)
    if (~path.indexOf('\0')) {
      this.error(400)
      return res
    }

    let parts
    if (root !== null) {
      // normalize
      if (path) {
        path = normalize('.' + sep + path)
      }

      // malicious path
      if (UP_PATH_REGEXP.test(path)) {
        debug('malicious path "%s"', path)
        this.error(403)
        return res
      }

      // explode path parts
      parts = path.split(sep)

      // join / normalize from optional root dir
      path = normalize(join(root, path))
    } else {
      // ".." is malicious without "root"
      if (UP_PATH_REGEXP.test(path)) {
        debug('malicious path "%s"', path)
        this.error(403)
        return res
      }

      // explode path parts
      parts = normalize(path).split(sep)

      // resolve the path
      path = resolve(path)
    }

    // dotfile handling
    if (
      (
        debug.enabled || // if debugging is enabled, then check for all cases to log allow case
        this._dotfiles !== 0 // if debugging is not enabled, then only check if 'deny' or 'ignore' is set
      ) &&
      containsDotFile(parts)
    ) {
      switch (this._dotfiles) {
        /* istanbul ignore next: unreachable, because NODE_DEBUG can not be set after process is running */
        case 0: // 'allow'
          debug('allow dotfile "%s"', path)
          break
        case 2: // 'deny'
          debug('deny dotfile "%s"', path)
          this.error(403)
          return res
        case 1: // 'ignore'
        default:
          debug('ignore dotfile "%s"', path)
          this.error(404)
          return res
      }
    }

    // index file support
    if (this._index.length && this.hasTrailingSlash()) {
      this.sendIndex(path)
      return res
    }

    this.sendFile(path)
    return res
  }

  /**
   * Transfer `path`.
   *
   * @param {String} path
   * @api public
   */

  send (path, stat) {
    let len = stat.size
    const options = this.options
    const opts = {}
    const res = this.res
    const req = this.req
    let offset = options.start ?? 0

    if (res.headersSent) {
      // impossible to send now
      this.headersAlreadySent()
      return
    }

    debug('pipe "%s"', path)

    // set header fields
    this.setHeader(path, stat)

    // set content-type
    this.type(path)

    // conditional GET support
    if (this.isConditionalGET()) {
      if (this.isPreconditionFailure()) {
        this.error(412)
        return
      }

      if (this.isCachable() && this.isNotModifiedFailure()) {
        this.notModified()
        return
      }
    }

    // adjust len to start/end options
    len = Math.max(0, len - offset)
    if (options.end !== undefined) {
      const bytes = options.end - offset + 1
      if (len > bytes) len = bytes
    }

    // Range support
    if (this._acceptRanges) {
      const rangeHeader = req.headers.range

      if (
        rangeHeader !== undefined &&
        BYTES_RANGE_REGEXP.test(rangeHeader)
      ) {
        // If-Range support
        if (this.isRangeFresh()) {
          // parse
          const ranges = parseBytesRange(len, rangeHeader)

          // unsatisfiable
          if (ranges.length === 0) {
            debug('range unsatisfiable')

            // Content-Range
            res.setHeader('Content-Range', contentRange('bytes', len))

            // 416 Requested Range Not Satisfiable
            return this.error(416, {
              headers: { 'Content-Range': res.getHeader('Content-Range') }
            })
            // valid (syntactically invalid/multiple ranges are treated as a regular response)
          } else if (ranges.length === 1) {
            debug('range %j', ranges)

            // Content-Range
            res.statusCode = 206
            res.setHeader('Content-Range', contentRange('bytes', len, ranges[0]))

            // adjust for requested range
            offset += ranges[0].start
            len = ranges[0].end - ranges[0].start + 1
          }
        } else {
          debug('range stale')
        }
      }
    }

    // clone options
    for (const prop in options) {
      opts[prop] = options[prop]
    }

    // set read options
    opts.start = offset
    opts.end = Math.max(offset, offset + len - 1)

    // content-length
    res.setHeader('Content-Length', len)

    // HEAD support
    if (req.method === 'HEAD') {
      res.end()
      return
    }

    this.stream(path, opts)
  }

  /**
   * Transfer file for `path`.
   *
   * @param {String} path
   * @api private
   */
  sendFile (path) {
    let i = 0
    const self = this

    debug('stat "%s"', path)
    fs.stat(path, function onstat (err, stat) {
      if (err && err.code === 'ENOENT' && !extname(path) && path[path.length - 1] !== sep) {
        // not found, check extensions
        return next(err)
      }
      if (err) return self.onStatError(err)
      if (stat.isDirectory()) return self.redirect(path)
      self.emit('file', path, stat)
      self.send(path, stat)
    })

    function next (err) {
      if (self._extensions.length <= i) {
        return err
          ? self.onStatError(err)
          : self.error(404)
      }

      const p = path + '.' + self._extensions[i++]

      debug('stat "%s"', p)
      fs.stat(p, function (err, stat) {
        if (err) return next(err)
        if (stat.isDirectory()) return next()
        self.emit('file', p, stat)
        self.send(p, stat)
      })
    }
  }

  /**
   * Transfer index for `path`.
   *
   * @param {String} path
   * @api private
   */
  sendIndex (path) {
    let i = -1
    const self = this

    function next (err) {
      if (++i >= self._index.length) {
        if (err) return self.onStatError(err)
        return self.error(404)
      }

      const p = join(path, self._index[i])

      debug('stat "%s"', p)
      fs.stat(p, function (err, stat) {
        if (err) return next(err)
        if (stat.isDirectory()) return next()
        self.emit('file', p, stat)
        self.send(p, stat)
      })
    }

    next()
  }

  /**
   * Stream `path` to the response.
   *
   * @param {String} path
   * @param {Object} options
   * @api private
   */

  stream (path, options) {
    const self = this
    const res = this.res

    // pipe
    const stream = fs.createReadStream(path, options)
    this.emit('stream', stream)
    stream.pipe(res)

    let destroyed = false

    // destroy piped stream
    function destroy () {
      if (destroyed) {
        return
      }
      destroyed = true
      stream.destroy()
    }

    res.once('finish', destroy)

    // error handling
    stream.on('error', function onerror (err) {
      // clean up stream early
      destroy()

      // error
      self.onStatError(err)
    })

    // end
    stream.on('end', function onend () {
      self.emit('end')
    })
  }

  /**
   * Set content-type based on `path`
   * if it hasn't been explicitly set.
   *
   * @param {String} path
   * @api private
   */

  type (path) {
    const res = this.res

    if (res.getHeader('Content-Type')) return

    const type = mime.getType(path) ?? mime.default_type

    if (!type) {
      debug('no content-type')
      return
    }

    debug('content-type %s', type)
    if (isUtf8MimeType(type)) {
      res.setHeader('Content-Type', type + '; charset=UTF-8')
    } else {
      res.setHeader('Content-Type', type)
    }
  }

  /**
   * Set response header fields, most
   * fields may be pre-defined.
   *
   * @param {String} path
   * @param {Object} stat
   * @api private
   */

  setHeader (path, stat) {
    const res = this.res

    this.emit('headers', res, path, stat)

    if (this._acceptRanges && !res.getHeader('Accept-Ranges')) {
      debug('accept ranges')
      res.setHeader('Accept-Ranges', 'bytes')
    }

    if (this._cacheControl && !res.getHeader('Cache-Control')) {
      let cacheControl = 'public, max-age=' + Math.floor(this._maxage / 1000)

      if (this._immutable) {
        cacheControl += ', immutable'
      }

      debug('cache-control %s', cacheControl)
      res.setHeader('Cache-Control', cacheControl)
    }

    if (this._lastModified && !res.getHeader('Last-Modified')) {
      const modified = stat.mtime.toUTCString()
      debug('modified %s', modified)
      res.setHeader('Last-Modified', modified)
    }

    if (this._etag && !res.getHeader('ETag')) {
      const etag = 'W/"' + stat.size.toString(16) + '-' + stat.mtime.getTime().toString(16) + '"'
      debug('etag %s', etag)
      res.setHeader('ETag', etag)
    }
  }
}

/**
 * Module exports.
 * https://stackoverflow.com/a/35339748/
 * @public
 */

module.exports = new Proxy(SendStream, {
  apply (Target, _, argumentsList) {
    return new Target(...argumentsList)
  }
})
