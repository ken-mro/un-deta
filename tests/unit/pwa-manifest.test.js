// manifest.webmanifest・アイコン一式・apple-touch-icon・theme-color の検証
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const path = (p) => new URL(`../../${p}`, import.meta.url);
const read = (p) => readFileSync(path(p), 'utf8');

/** PNG の幅・高さ・カラータイプを IHDR から読む */
function pngInfo(p) {
  const buf = readFileSync(path(p));
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${p} は PNG`);
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

const manifest = () => JSON.parse(read('manifest.webmanifest'));

test('manifest: 必須項目とサブパスで動く相対パス', () => {
  const m = manifest();
  assert.equal(m.name, 'うん、出た。');
  assert.ok(m.short_name);
  assert.equal(m.lang, 'ja');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  for (const icon of m.icons) {
    assert.doesNotMatch(icon.src, /^(\/|https?:)/, `${icon.src} は相対パス`);
  }
});

test('manifest: 192/512 の通常アイコンと maskable アイコンがあり、実寸と一致', () => {
  const { icons } = manifest();
  for (const purpose of ['any', 'maskable']) {
    for (const size of [192, 512]) {
      const icon = icons.find((i) => i.sizes === `${size}x${size}` && (i.purpose ?? 'any') === purpose);
      assert.ok(icon, `${purpose} ${size}`);
      assert.equal(icon.type, 'image/png');
      const info = pngInfo(icon.src.replace(/^\.\//, ''));
      assert.equal(info.width, size);
      assert.equal(info.height, size);
    }
  }
});

test('apple-touch-icon は 180x180 の PNG', () => {
  const info = pngInfo('icons/apple-touch-icon.png');
  assert.equal(info.width, 180);
  assert.equal(info.height, 180);
});

test('元の SVG を同梱し、外部参照を含まない', () => {
  for (const f of ['icons/icon.svg', 'icons/icon-maskable.svg']) {
    assert.ok(existsSync(path(f)), f);
    const svg = read(f);
    assert.doesNotMatch(svg.replace(/xmlns(:\w+)?="http:\/\/www\.w3\.org\/[^"]+"/g, ''), /https?:\/\//, `${f} に外部参照なし`);
    assert.doesNotMatch(svg, /<(script|text|image|foreignObject)\b/, `${f} はパスのみ（フォント・画像・スクリプトに依存しない）`);
  }
});

test('index.html: manifest・アイコン・theme-color（ライト／ダーク）', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png">/);
  assert.match(html, /<link rel="icon" href="\.\/icons\/icon\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: light\)">/i);
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)">/i);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="うん、出た。">/);
});
