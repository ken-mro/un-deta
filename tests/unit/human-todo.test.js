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

test('SPEC.md は仕様変更（「出た」だけ）を反映済みで、HUMAN_TODO でも完了になっている', () => {
  const spec = readFileSync(new URL('SPEC.md', root), 'utf8');
  assert.match(spec, /記録項目は「出た」のみ/);
  assert.doesNotMatch(spec, /\{\{CONTACT\}\}/);
  assert.match(todo, /^- \[x\] .*SPEC\.md/m);
});

test('チェックボックス形式で、主要な確認事項を含む', () => {
  assert.match(todo, /^- \[ \] /m);
  for (const kw of ['利用規約', 'プライバシーポリシー', '実機', 'GitHub Pages', '依存']) {
    assert.ok(todo.includes(kw), `「${kw}」に触れている`);
  }
});
