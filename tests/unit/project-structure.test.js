// プロジェクト土台（package.json / .gitignore / ディレクトリ構成 / 依存のセキュリティ設定）の検証
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(`../../${p}`, import.meta.url));

test('package.json: ES Modules・非公開・テストスクリプト', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.private, true, '誤って npm publish されないよう private: true');
  assert.match(pkg.scripts.test, /node --test/);
  assert.match(pkg.scripts['test:e2e'], /playwright test/);
});

test('package.json: アプリ本体の依存なし・開発依存はバージョン固定', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies, undefined, 'dependencies は持たない（開発依存のみ）');
  for (const [name, ver] of Object.entries(pkg.devDependencies ?? {})) {
    assert.match(ver, /^\d+\.\d+\.\d+$/, `${name} は完全固定バージョンにする（^ や ~ を使わない）`);
  }
  assert.match(pkg.packageManager ?? '', /^pnpm@\d+\.\d+\.\d+$/);
});

test('依存のサプライチェーン対策設定', () => {
  const npmrc = read('.npmrc');
  assert.match(npmrc, /^ignore-scripts=true$/m, 'install スクリプトを実行しない');
  assert.match(npmrc, /^save-exact=true$/m);
  const ws = read('pnpm-workspace.yaml');
  assert.match(ws, /^minimumReleaseAge:\s*\d+/m, '公開直後のパッケージを入れない');
  assert.match(ws, /^blockExoticSubdeps:\s*true/m);
});

test('.gitignore: 生成物・ログ・秘密情報を除外', () => {
  const lines = read('.gitignore').split('\n').map((l) => l.trim());
  for (const entry of ['node_modules/', '.loop-logs/', 'test-results/', 'playwright-report/', '.env']) {
    assert.ok(lines.includes(entry), `.gitignore に ${entry}`);
  }
});

test('ディレクトリ構成', () => {
  for (const d of ['src', 'src/lib', 'tests/unit', 'tests/e2e']) {
    assert.ok(exists(d) && statSync(new URL(`../../${d}`, import.meta.url)).isDirectory(), `${d}/ がある`);
  }
});
