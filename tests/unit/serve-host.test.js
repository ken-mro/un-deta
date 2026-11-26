// scripts/serve.mjs の待ち受けアドレス指定（既定は 127.0.0.1、他端末からの確認用に :: を明示指定できる）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';

const root = fileURLToPath(new URL('../fixtures/site/', import.meta.url));

test('host を指定するとそのアドレスで待ち受ける（:: = IPv4/IPv6 両方）', async () => {
  const server = await startServer({ root, port: 0, host: '::' });
  try {
    assert.equal(server.address().address, '::');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('host 未指定なら 127.0.0.1 のまま', async () => {
  const server = await startServer({ root, port: 0 });
  try {
    assert.equal(server.address().address, '127.0.0.1');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
