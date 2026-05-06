import { Dirent } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { expect } from 'tstyche'
import send, {
  DirectorySendResult,
  ErrorSendResult,
  FileSendResult,
  SendResult
} from '..'

send.mime.define({
  'application/x-my-type': ['x-mt', 'x-mtt']
})

expect(send.isUtf8MimeType).type.toBe<(value: string) => boolean>()
expect(send.isUtf8MimeType('application/json')).type.toBe<boolean>()

const req: any = {};

(async () => {
  {
    const result = await send(req, '/test.html', {
      acceptRanges: true,
      maxContentRangeChunkSize: 10,
      immutable: true,
      maxAge: 0,
      root: resolve(__dirname, '/wwwroot')
    })

    expect(result).type.toBe<SendResult>()
    expect(result.statusCode).type.toBe<number>()
    expect(result.headers).type.toBe<Record<string, string>>()
    expect(result.stream).type.toBe<Readable>()
  }

  {
    const result = await send(req, '/test.html', {
      contentType: true,
      maxAge: 0,
      root: resolve(__dirname, '/wwwroot')
    })

    expect(result).type.toBe<SendResult>()
    expect(result.statusCode).type.toBe<number>()
    expect(result.headers).type.toBe<Record<string, string>>()
    expect(result.stream).type.toBe<Readable>()
  }

  const result = await send(req, '/test.html')

  switch (result.type) {
    case 'file': {
      expect(result).type.toBe<FileSendResult>()
      expect(result.metadata.path).type.toBe<string>()
      expect(result.metadata.stat).type.toBe<Dirent>()
      break
    }
    case 'directory': {
      expect(result).type.toBe<DirectorySendResult>()
      expect(result.metadata.path).type.toBe<string>()
      expect(result.metadata.requestPath).type.toBe<string>()
      break
    }
    case 'error': {
      expect(result).type.toBe<ErrorSendResult>()
      expect(result.metadata.error).type.toBe<Error>()
      break
    }
  }
})()
