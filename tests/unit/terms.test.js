// terms.html（利用規約）が SPEC の必須項目をすべて含むこと
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../terms.html', import.meta.url), 'utf8');
const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());

test('タイトルと h1', () => {
  assert.match(html, /<title>利用規約 \| うん、出た。<\/title>/);
  assert.match(html, /<h1[^>]*>利用規約<\/h1>/);
  assert.doesNotMatch(text, /作成中/);
});

test('必須の見出しがそろっている', () => {
  for (const h of ['サービス内容', '医療に関する注意', '免責', '禁止事項', '規約の変更', '準拠法', 'お問い合わせ']) {
    assert.ok(headings.some((x) => x.includes(h)), `見出し「${h}」`);
  }
});

test('医療機器ではなく、診断・治療を目的としないこと／医療機関への相談', () => {
  assert.match(text, /医療機器ではありません/);
  assert.match(text, /診断・治療.{0,20}目的としません/);
  assert.match(text, /医療機関/);
});

test('データ消失を含む無保証・免責', () => {
  assert.match(text, /データ.{0,20}消失/);
  assert.match(text, /保証しません/);
  assert.match(text, /責任を負いません/);
});

test('準拠法は日本法', () => {
  assert.match(text, /日本法/);
});

test('運営者 ken_mro、問い合わせ先プレースホルダ、制定日', () => {
  assert.match(text, /ken_mro/);
  assert.match(text, /\{\{CONTACT\}\}/);
  assert.match(text, /制定日[:：]\s*\d{4}年\d{1,2}月\d{1,2}日/);
});

test('効能をうたわない', () => {
  assert.doesNotMatch(text, /便秘(を|が)?(改善|解消|治)|健康にな|治る/);
});

test('アプリと同じデザイン（共通 CSS）・CSP・外部読み込みなし・アプリへの戻りリンク', () => {
  assert.match(html, /<link rel="stylesheet" href="\.\/src\/styles\.css">/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /(src|href)="https?:\/\//);
  assert.match(html, /<a href="\.\/">/);
});
