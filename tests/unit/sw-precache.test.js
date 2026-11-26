// service worker のプリキャッシュ一覧が、実際の配布ファイルと一致していること
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');

function precacheList() {
  const m = sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  assert.ok(m, 'sw.js に const PRECACHE = [...] がある');
  return JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
}

function walk(dir) {
  return readdirSync(new URL(dir, root)).flatMap((name) => {
    const rel = `${dir}${name}`;
    return statSync(new URL(rel, root)).isDirectory() ? walk(`${rel}/`) : [rel];
  });
}

test('プリキャッシュは相対パスで、すべて存在する', () => {
  for (const p of precacheList()) {
    assert.match(p, /^\.\//, `${p} は ./ で始まる`);
    if (p === './') continue;
    assert.ok(existsSync(new URL(p.slice(2), root)), `${p} が存在する`);
  }
});

test('配布ファイルをすべてプリキャッシュしている（terms / privacy を含む）', () => {
  const list = new Set(precacheList());
  const expected = [
    './',
    './index.html',
    './terms.html',
    './privacy.html',
    './manifest.webmanifest',
    ...walk('src/').map((f) => `./${f}`),
    ...walk('icons/').map((f) => `./${f}`),
  ];
  for (const f of expected) assert.ok(list.has(f), `${f} がプリキャッシュされている`);
  assert.equal(list.size, expected.length, '余計なものを含まない');
});

test('キャッシュ名にバージョンを含む', () => {
  assert.match(sw, /const VERSION = '[^']+';/);
  assert.match(sw, /un-deta-\$\{VERSION\}/);
});

test('同一オリジンの GET だけを扱う', () => {
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
});
