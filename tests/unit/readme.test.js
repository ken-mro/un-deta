// README.md（日本語）の必須項目
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const md = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const headings = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);

test('タイトル', () => assert.match(md, /^# うん、出た。/m));

test('必須の見出し', () => {
  for (const h of ['概要', '使い方', 'プライバシー', 'ローカルで起動', 'テスト', 'GitHub Pages']) {
    assert.ok(headings.some((x) => x.includes(h)), `見出し「${h}」`);
  }
});

test('実際のコマンド・パスと一致している', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.match(md, /pnpm install/);
  assert.match(md, /npm test|pnpm test/);
  assert.match(md, /test:e2e/);
  assert.ok(pkg.scripts['test:e2e'] && pkg.scripts.test && pkg.scripts.serve);
  assert.match(md, /scripts\/serve\.mjs/);
  assert.match(md, /--base \/un-deta\//);
  assert.match(md, /https:\/\/ken-mro\.github\.io\/un-deta\//);
  assert.match(md, /playwright install/);
});

test('プライバシー方針の要約（端末内のみ・収集しない・外部送信なし）', () => {
  assert.match(md, /端末/);
  assert.match(md, /収集しません/);
  assert.match(md, /送信しません/);
});

test('効能をうたわない', () => {
  assert.doesNotMatch(md, /便秘(を|が)?(改善|解消|治)|健康にな|治る/);
});

test('記録するのは「出た」だけ（仕様変更）', () => {
  assert.match(md, /前回の「出た」から/);
  assert.doesNotMatch(md, /連続日数/);
  assert.doesNotMatch(md, /「出てない」を押/);
});

test('「ちょっと出た」の使い方を説明している', () => {
  assert.match(md, /ちょっと出た/);
});
