// 配布ファイルに外部 URL の読み込みが混入していないこと（静的チェック）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const walk = (dir) =>
  readdirSync(new URL(dir, root)).flatMap((n) => (statSync(new URL(`${dir}${n}`, root)).isDirectory() ? walk(`${dir}${n}/`) : [`${dir}${n}`]));

// 許可する外部 URL: SVG の名前空間（読み込みではない）と、プライバシーポリシーから GitHub のポリシーへのリンク
const ALLOWED = [
  /^http:\/\/www\.w3\.org\/2000\/svg$/,
  /^https:\/\/docs\.github\.com\/ja\/site-policy\/privacy-policies\/github-general-privacy-statement$/,
];

const files = [
  ...readdirSync(root).filter((f) => /\.(html|js|webmanifest)$/.test(f) && f !== 'playwright.config.js'),
  ...walk('src/'),
  ...walk('icons/').filter((f) => f.endsWith('.svg')),
];

test('配布ファイル中の外部 URL は許可リストのものだけ', () => {
  assert.ok(files.includes('index.html') && files.includes('sw.js'));
  for (const f of files) {
    const urls = readFileSync(new URL(f, root), 'utf8').match(/\b(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)`]*/gi) ?? [];
    for (const url of urls) assert.ok(ALLOWED.some((re) => re.test(url)), `${f}: ${url}`);
  }
});

test('GitHub のポリシーへのリンクは privacy.html の <a href> だけ', () => {
  for (const f of files) {
    const src = readFileSync(new URL(f, root), 'utf8');
    if (!src.includes('docs.github.com')) continue;
    assert.equal(f, 'privacy.html');
    assert.match(src, /<a href="https:\/\/docs\.github\.com\/[^"]+" rel="noopener noreferrer"/);
  }
});

test('CSS の url() / @import で外部を読み込まない', () => {
  for (const f of files.filter((x) => x.endsWith('.css'))) {
    const css = readFileSync(new URL(f, root), 'utf8');
    assert.doesNotMatch(css, /@import/, f);
    for (const [, u] of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) assert.match(u, /^(data:|\.\/|[a-z0-9_-]+\/)/i, `${f}: url(${u})`);
  }
});
