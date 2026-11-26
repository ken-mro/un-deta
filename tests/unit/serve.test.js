// scripts/serve.mjs（依存なしの静的配信サーバ）の検証
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';

const root = fileURLToPath(new URL('../fixtures/site/', import.meta.url));
let server;
let port;

// fetch は URL を正規化してしまうため、生のパスを送れる http.request を使う
const get = (path, method = 'GET') =>
  new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });

before(async () => {
  server = await startServer({ root, port: 0 });
  port = server.address().port;
});
after(() => new Promise((r) => server.close(r)));

test('127.0.0.1 でのみ待ち受ける', () => {
  assert.equal(server.address().address, '127.0.0.1');
});

test('/ で index.html を text/html で返す', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/html/);
  assert.match(res.body, /fixture/);
});

test('JS は ES Modules として読める MIME で返す', async () => {
  const res = await get('/sub/a.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/javascript/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});

test('存在しないファイルは 404', async () => {
  assert.equal((await get('/nope.html')).status, 404);
});

test('ディレクトリ一覧は出さない', async () => {
  const res = await get('/sub/');
  assert.equal(res.status, 404);
});

test('パストラバーサルでルート外を読めない', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/sub/..%2f..%2fsecret.txt', '/..%5csecret.txt']) {
    const res = await get(p);
    assert.notEqual(res.status, 200, p);
    assert.doesNotMatch(res.body, /SECRET/, p);
  }
});

test('不正なパーセントエンコードやヌル文字でも落ちない', async () => {
  assert.equal((await get('/%E0%A4%A')).status, 400);
  assert.equal((await get('/index.html%00.js')).status, 400);
  assert.equal((await get('/')).status, 200, 'その後も応答する');
});

test('GET / HEAD 以外は 405', async () => {
  assert.equal((await get('/', 'POST')).status, 405);
  const head = await get('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('ドットファイル（.hidden, .git など）は返さない', async () => {
  const res = await get('/.hidden');
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.body, /TOKEN/);
  assert.equal((await get('/.git/config')).status, 404);
});
