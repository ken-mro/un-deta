// HUMAN_TODO.md: 人間が確認・対応すべき事項
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const todo = readFileSync(new URL('HUMAN_TODO.md', root), 'utf8');

test('{{CONTACT}} を含むすべての配布ファイルが差し替え対象として挙がっている', () => {
  assert.match(todo, /\{\{CONTACT\}\}/);
  assert.match(todo, /差し替え/);
  const files = readdirSync(root).filter((f) => /\.(html|webmanifest|js)$/.test(f));
  const withPlaceholder = files.filter((f) => readFileSync(new URL(f, root), 'utf8').includes('{{CONTACT}}'));
  assert.ok(withPlaceholder.length >= 2, 'terms.html / privacy.html に含まれている');
  for (const f of withPlaceholder) assert.ok(todo.includes(f), `${f} が HUMAN_TODO.md に書かれている`);
});

test('チェックボックス形式で、主要な確認事項を含む', () => {
  assert.match(todo, /^- \[ \] /m);
  for (const kw of ['利用規約', 'プライバシーポリシー', '実機', 'GitHub Pages', '依存']) {
    assert.ok(todo.includes(kw), `「${kw}」に触れている`);
  }
});
