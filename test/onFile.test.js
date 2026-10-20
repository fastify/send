'use strict'

const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const send = require('..')

const fixtures = path.join(__dirname, 'fixtures')

function createRequest (method = 'GET', headers = {}) {
  return { method, headers }
}

function destroyStream (result) {
  result.stream.destroy()
}

test('onFile receives the final selected file', async function (t) {
  const cases = [
    {
      name: 'direct file',
      requestPath: '/name.txt',
      options: {},
      expectedPath: path.join(fixtures, 'name.txt')
    },
    {
      name: 'default index',
      requestPath: '/pets/',
      options: {},
      expectedPath: path.join(fixtures, 'pets', 'index.html')
    },
    {
      name: 'custom index',
      requestPath: '/',
      options: { index: ['missing.html', 'pets', 'tobi.html'] },
      expectedPath: path.join(fixtures, 'tobi.html')
    },
    {
      name: 'extension fallback',
      requestPath: '/name',
      options: { extensions: ['missing', 'dir', 'html'] },
      expectedPath: path.join(fixtures, 'name.html')
    }
  ]

  for (const testCase of cases) {
    await t.test(testCase.name, async function (t) {
      let calls = 0
      let selectedPath
      let selectedStat
      const result = await send(createRequest(), testCase.requestPath, {
        ...testCase.options,
        root: fixtures,
        onFile (filePath, stat) {
          calls++
          selectedPath = filePath
          selectedStat = stat
        }
      })

      t.assert.strictEqual(calls, 1)
      t.assert.strictEqual(selectedPath, testCase.expectedPath)
      t.assert.strictEqual(selectedStat, result.metadata.stat)
      t.assert.ok(selectedStat instanceof fs.Stats)
      destroyStream(result)
    })
  }
})

test('onFile is not called for directory or error results', async function (t) {
  let calls = 0
  const options = {
    root: fixtures,
    onFile () {
      calls++
    }
  }

  const directoryResult = await send(createRequest(), '/pets', options)
  t.assert.strictEqual(directoryResult.type, 'directory')
  destroyStream(directoryResult)

  const errorResult = await send(createRequest(), '/missing.txt', options)
  t.assert.strictEqual(errorResult.type, 'error')
  destroyStream(errorResult)

  t.assert.strictEqual(calls, 0)
})

test('onFile waits before creating the file stream', { timeout: 5000 }, async function (t) {
  const originalCreateReadStream = fs.createReadStream
  const events = []
  let releaseHook
  let markHookStarted
  const hookStarted = new Promise((resolve) => {
    markHookStarted = resolve
  })
  const hookGate = new Promise((resolve) => {
    releaseHook = resolve
  })

  fs.createReadStream = function (...args) {
    events.push('stream')
    return originalCreateReadStream.apply(this, args)
  }

  try {
    let settled = false
    const pending = send(createRequest(), '/name.txt', {
      root: fixtures,
      async onFile () {
        events.push('hook start')
        markHookStarted()
        await hookGate
        events.push('hook end')
      }
    }).then((result) => {
      settled = true
      return result
    })

    await hookStarted
    await Promise.resolve()
    t.assert.strictEqual(settled, false)
    t.assert.deepStrictEqual(events, ['hook start'])

    releaseHook()
    const result = await pending
    t.assert.deepStrictEqual(events, ['hook start', 'hook end', 'stream'])
    destroyStream(result)
  } finally {
    fs.createReadStream = originalCreateReadStream
  }
})

test('onFile errors reject send unchanged before stream creation', async function (t) {
  const originalCreateReadStream = fs.createReadStream
  let streamCalls = 0

  fs.createReadStream = function (...args) {
    streamCalls++
    return originalCreateReadStream.apply(this, args)
  }

  try {
    const thrownError = new Error('thrown by onFile')
    await t.assert.rejects(
      send(createRequest(), '/name.txt', {
        root: fixtures,
        onFile () {
          throw thrownError
        }
      }),
      (error) => error === thrownError
    )

    const rejectedError = new Error('rejected by onFile')
    await t.assert.rejects(
      send(createRequest(), '/name.txt', {
        root: fixtures,
        onFile () {
          return Promise.reject(rejectedError)
        }
      }),
      (error) => error === rejectedError
    )

    t.assert.strictEqual(streamCalls, 0)
  } finally {
    fs.createReadStream = originalCreateReadStream
  }
})

test('onFile is called for ranged GET requests', async function (t) {
  let calls = 0
  const result = await send(
    createRequest('GET', { range: 'bytes=0-4' }),
    '/nums.txt',
    {
      root: fixtures,
      onFile (filePath) {
        calls++
        t.assert.strictEqual(filePath, path.join(fixtures, 'nums.txt'))
      }
    }
  )

  t.assert.strictEqual(calls, 1)
  t.assert.strictEqual(result.statusCode, 206)
  t.assert.strictEqual(result.headers['Content-Range'], 'bytes 0-4/9')

  let body = ''
  for await (const chunk of result.stream) {
    body += chunk
  }
  t.assert.strictEqual(body, '12345')
})

test('onFile is called for HEAD and conditional requests', async function (t) {
  const originalCreateReadStream = fs.createReadStream
  let streamCalls = 0
  const methods = []

  fs.createReadStream = function (...args) {
    streamCalls++
    return originalCreateReadStream.apply(this, args)
  }

  try {
    const headResult = await send(createRequest('HEAD'), '/name.txt', {
      root: fixtures,
      onFile () {
        methods.push('HEAD')
      }
    })
    t.assert.strictEqual(headResult.statusCode, 200)
    destroyStream(headResult)

    const conditionalResult = await send(
      createRequest('GET', { 'if-none-match': '*' }),
      '/name.txt',
      {
        root: fixtures,
        onFile () {
          methods.push('conditional')
        }
      }
    )
    t.assert.strictEqual(conditionalResult.statusCode, 304)
    destroyStream(conditionalResult)

    t.assert.deepStrictEqual(methods, ['HEAD', 'conditional'])
    t.assert.strictEqual(streamCalls, 0)
  } finally {
    fs.createReadStream = originalCreateReadStream
  }
})

test('onFile must be a function when provided', async function (t) {
  await t.assert.rejects(
    send(createRequest(), '/name.txt', { root: fixtures, onFile: null }),
    {
      name: 'TypeError',
      message: 'onFile option must be a function'
    }
  )
})
