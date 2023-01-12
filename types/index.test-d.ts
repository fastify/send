import { expectType } from 'tsd'
import send from '..'

send.mime.define({
  'application/x-my-type': ['x-mt', 'x-mtt']
});

expectType<(value: string) => boolean>(send.isUtf8MimeType)
expectType<boolean>(send.isUtf8MimeType('application/json'))

const req: any = {}
const res: any = {}

send(req, '/test.html', {
  immutable: true,
  maxAge: 0,
  root: __dirname + '/wwwroot'
}).pipe(res);

send(req, '/test.html')
  .maxage(0)
  .root(__dirname + '/wwwroot')
  .on('error', (err: any) => {
    res.statusCode = err.status || 500;
    res.end(err.message);
  })
  .on('directory', () => {
    res.statusCode = 301;
    res.setHeader('Location', req.url + '/');
    res.end(`Redirecting to ${req.url}/`);
  })
  .on('headers', (res: any, path: string, stat: any) => {
    res.setHeader('Content-Disposition', 'attachment');
  })
  .pipe(res);