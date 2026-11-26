// scripts/serve.mjs のサブパス配信（GitHub Pages の /un-deta/ を再現）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';

const root = fileURLToPath(new URL('../fixtures/site/', import.meta.url));
let server;
let port;

const get = (path) =>
  new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });

before(async () => {
  server = await startServer({ root, port: 0, base: '/un-deta/' });
  port = server.address().port;
});
after(() => new Promise((r) => server.close(r)));

test('base 配下でファイルを返す', async () => {
  const res = await get('/un-deta/');
  assert.equal(res.status, 200);
  assert.match(res.body, /fixture/);
  assert.equal((await get('/un-deta/sub/a.js')).status, 200);
});

test('base の外は 404（ルート直下に置いたつもりの絶対パスを検出できる）', async () => {
  assert.equal((await get('/')).status, 404);
  assert.equal((await get('/index.html')).status, 404);
  assert.equal((await get('/sub/a.js')).status, 404);
  assert.equal((await get('/un-detax/index.html')).status, 404);
});

test('末尾スラッシュなしは base へリダイレクト', async () => {
  const res = await get('/un-deta');
  assert.equal(res.status, 301);
  assert.equal(res.headers.location, '/un-deta/');
});

test('base 配下でもパストラバーサルは防ぐ', async () => {
  for (const p of ['/un-deta/../secret.txt', '/un-deta/%2e%2e/secret.txt']) {
    const res = await get(p);
    assert.notEqual(res.status, 200, p);
  }
});

test('不正な base は拒否', async () => {
  for (const base of ['un-deta', '/un-deta']) {
    let started;
    await assert.rejects(async () => {
      started = await startServer({ root, port: 0, base });
    }, TypeError, base);
    // 誤って起動してしまった場合もテストが終わるように閉じる
    if (started) await new Promise((r) => started.close(r));
  }
});
