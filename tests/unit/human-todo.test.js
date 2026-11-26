// HUMAN_TODO.md: 人間が確認・対応すべき事項
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const todo = readFileSync(new URL('HUMAN_TODO.md', root), 'utf8');

test('問い合わせ先は差し替え済み: 配布ファイルに {{CONTACT}} が残っておらず、HUMAN_TODO でも完了になっている', () => {
  const files = readdirSync(root).filter((f) => /\.(html|webmanifest|js|md)$/.test(f) && !['HUMAN_TODO.md', 'PROGRESS.md', 'PLAN.md', 'SPEC.md', 'SETUP.md'].includes(f));
  for (const f of files) assert.doesNotMatch(readFileSync(new URL(f, root), 'utf8'), /\{\{CONTACT\}\}/, f);
  assert.match(todo, /^- \[x\] .*問い合わせ先.*差し替え/m);
});

test('SPEC.md の更新（仕様変更）を人間に依頼している', () => {
  assert.match(todo, /^- \[ \] .*SPEC\.md/m);
  assert.match(todo, /「出た」だけ/);
});

test('チェックボックス形式で、主要な確認事項を含む', () => {
  assert.match(todo, /^- \[ \] /m);
  for (const kw of ['利用規約', 'プライバシーポリシー', '実機', 'GitHub Pages', '依存']) {
    assert.ok(todo.includes(kw), `「${kw}」に触れている`);
  }
});
