import { Readable } from 'stream';
import { expectType } from 'tsd';
import send, { SendResult } from '..';

send.mime.define({
  'application/x-my-type': ['x-mt', 'x-mtt']
});

expectType<(value: string) => boolean>(send.isUtf8MimeType)
expectType<boolean>(send.isUtf8MimeType('application/json'))

const req: any = {}

{
  const result = await send(req, '/test.html', {
    immutable: true,
    maxAge: 0,
    root: __dirname + '/wwwroot'
  });

  expectType<SendResult>(result)
  expectType<number>(result.statusCode)
  expectType<Record<string, string>>(result.headers)
  expectType<Readable>(result.stream)
}

{
  const result = await send(req, '/test.html', { maxAge: 0, root: __dirname + '/wwwroot' })

  expectType<SendResult>(result)
  expectType<number>(result.statusCode)
  expectType<Record<string, string>>(result.headers)
  expectType<Readable>(result.stream)
}

