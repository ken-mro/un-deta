// privacy.html（プライバシーポリシー）が SPEC の必須項目をすべて含むこと
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../privacy.html', import.meta.url), 'utf8');
const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());

test('タイトルと h1', () => {
  assert.match(html, /<title>プライバシーポリシー \| うん、出た。<\/title>/);
  assert.match(html, /<h1[^>]*>プライバシーポリシー<\/h1>/);
  assert.doesNotMatch(text, /作成中/);
});

test('必須の見出しがそろっている', () => {
  for (const h of ['収集する情報', '記録の保存場所', 'アナリティクス', 'ホスティング', '端末の変更', 'お問い合わせ', '改定']) {
    assert.ok(headings.some((x) => x.includes(h)), `見出し「${h}」`);
  }
});

test('個人情報・記録データを一切収集しない', () => {
  assert.match(text, /個人情報.{0,30}一切収集しません/);
  assert.match(text, /記録データ/);
});

test('記録は端末内（ブラウザのストレージ）のみに保存', () => {
  assert.match(text, /端末/);
  assert.match(text, /ブラウザのストレージ/);
});

test('アナリティクス・Cookie・外部送信を行わない', () => {
  assert.match(text, /アナリティクス/);
  assert.match(text, /Cookie/);
  assert.match(text, /外部.{0,10}送信しません/);
});

test('GitHub がアクセスログ等を取得する可能性と、GitHub のプライバシーポリシーへのリンク', () => {
  assert.match(text, /GitHub/);
  assert.match(text, /アクセスログ/);
  const links = [...html.matchAll(/<a\s+([^>]*)>/g)].map((m) => m[1]);
  const gh = links.find((a) => /href="https:\/\/docs\.github\.com\/[^"]*privacy[^"]*"/.test(a));
  assert.ok(gh, 'GitHub のプライバシーポリシーへのリンク');
  assert.match(gh, /rel="noopener noreferrer"/);
});

test('端末変更・削除時のデータの扱い', () => {
  assert.match(text, /機種変更/);
  assert.match(text, /削除/);
});

test('問い合わせ先・運営者・制定日', () => {
  assert.match(text, /ken_mro/);
  assert.match(text, /\{\{CONTACT\}\}/);
  assert.match(text, /制定日[:：]\s*\d{4}年\d{1,2}月\d{1,2}日/);
});

test('外部リンクは GitHub のポリシー（<a href>）だけで、外部リソースを読み込まない', () => {
  const external = [...html.matchAll(/(src|href)="(https?:\/\/[^"]+)"/g)];
  for (const [, attr, url] of external) {
    assert.equal(attr, 'href', `${url} は読み込みではなくリンク`);
    assert.match(url, /^https:\/\/docs\.github\.com\//);
  }
  assert.match(html, /<link rel="stylesheet" href="\.\/src\/styles\.css">/);
  assert.match(html, /Content-Security-Policy/);
});
