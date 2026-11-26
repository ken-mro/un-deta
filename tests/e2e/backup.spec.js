// バックアップ画面: コピー、貼り付けでのインポート（上書き／統合）、エラー表示
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved } from './helpers.js';
import { encodeBackup } from '../../src/lib/backup-codec.js';

test.beforeEach(async ({ page }) => fixToday(page));

const section = (page) => page.getByRole('region', { name: 'バックアップ' });
const exportBox = (page) => section(page).getByLabel('バックアップ用の文字列');
const importBox = (page) => section(page).getByLabel('バックアップの文字列を貼り付け');
const importDialog = (page) => page.getByRole('dialog', { name: 'バックアップの読み込み' });

// 仕様変更により記録は「出た」(1) だけ
const CURRENT = { '2024-03-01': 1, '2024-03-02': 1, '2024-03-03': 1 };
const INCOMING = { '2024-02-20': 1, '2024-03-05': 1 };

test('今の記録のバックアップ文字列が表示され、記録すると更新される', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await expect(exportBox(page)).toHaveValue(encodeBackup(CURRENT));
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(exportBox(page)).toHaveValue(encodeBackup({ ...CURRENT, '2024-03-10': 1 }));
});

test('コピーすると知らせて、最終バックアップ日を記録する', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await section(page).getByRole('button', { name: 'コピー' }).click();
  await expect(section(page).getByRole('status')).toContainText('コピーしました');
  expect((await readSaved(page)).lastBackupKey).toBe('2024-03-10');
  await expect(section(page)).toContainText('最後のバックアップ: 2024年3月10日');
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(encodeBackup(CURRENT));
  }
});

test('クリップボードが使えないときは文字列を選択して手動コピーを案内する', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await section(page).getByRole('button', { name: 'コピー' }).click();
  await expect(section(page).getByRole('status')).toContainText('選択した文字列を長押し');
  expect((await readSaved(page)).lastBackupKey).toBeNull();
});

test('不正な文字列は丁寧なエラーで弾き、記録を壊さない', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await importBox(page).fill('これはバックアップではない');
  await section(page).getByRole('button', { name: '読み込む' }).click();
  await expect(section(page).getByRole('alert')).toContainText('読み取れませんでした');
  await expect(importDialog(page)).toBeHidden();
  expect((await readSaved(page)).records).toEqual(CURRENT);
  await importBox(page).fill('');
  await section(page).getByRole('button', { name: '読み込む' }).click();
  await expect(section(page).getByRole('alert')).toContainText('入力されていません');
});

test('上書き: 確認のうえ、読み込んだ内容に置き換わる', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await importBox(page).fill(encodeBackup(INCOMING));
  await section(page).getByRole('button', { name: '読み込む' }).click();
  const dialog = importDialog(page);
  await expect(dialog).toContainText('2日分');
  await dialog.getByRole('button', { name: '上書きする' }).click();
  await expect(dialog).toContainText('今の記録（3日分）はすべて消えて');
  await dialog.getByRole('button', { name: '上書きを実行' }).click();
  await expect(dialog).toBeHidden();
  expect((await readSaved(page)).records).toEqual(INCOMING);
  await expect(section(page).getByRole('status')).toContainText('読み込みました');
  await expect(page.locator('[data-date="2024-03-01"]')).toHaveAttribute('data-status', '0');
  await expect(importBox(page)).toHaveValue('');
});

test('統合（衝突なし）: 両方の記録が残る', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await importBox(page).fill(encodeBackup({ '2024-02-20': 1, '2024-03-01': 1 }));
  await section(page).getByRole('button', { name: '読み込む' }).click();
  await importDialog(page).getByRole('button', { name: '統合する' }).click();
  await expect(importDialog(page)).toBeHidden();
  expect((await readSaved(page)).records).toEqual({ ...CURRENT, '2024-02-20': 1 });
});

test('統合: 衝突は起きないので確認なしで合わさる（今の記録も残る）', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await importBox(page).fill(encodeBackup(INCOMING));
  await section(page).getByRole('button', { name: '読み込む' }).click();
  const dialog = importDialog(page);
  await expect(dialog).toContainText('新しく増える日 2日');
  await dialog.getByRole('button', { name: '統合する' }).click();
  await expect(dialog).toBeHidden();
  expect((await readSaved(page)).records).toEqual({ ...CURRENT, ...INCOMING });
});

test('読み込むデータに含まれる「出てない」（旧形式の記録）は未記録として無視する', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  // 03-02 は今の記録が「出た」、読み込み側が「出てない」→ 今の記録が残る
  await importBox(page).fill(encodeBackup({ '2024-02-20': 1, '2024-02-21': 2, '2024-03-02': 2 }));
  await section(page).getByRole('button', { name: '読み込む' }).click();
  const dialog = importDialog(page);
  await expect(dialog).toContainText('読み込む記録: 1日分');
  await dialog.getByRole('button', { name: '統合する' }).click();
  await expect(dialog).toBeHidden();
  expect((await readSaved(page)).records).toEqual({ ...CURRENT, '2024-02-20': 1 });
});

test('上書きでも「出てない」は取り込まない', async ({ page }) => {
  await page.goto('/');
  await importBox(page).fill(encodeBackup({ '2024-02-20': 1, '2024-02-21': 2 }));
  await section(page).getByRole('button', { name: '読み込む' }).click();
  await importDialog(page).getByRole('button', { name: '上書きする' }).click();
  await expect(importDialog(page)).toBeHidden();
  expect((await readSaved(page)).records).toEqual({ '2024-02-20': 1 });
});

test('やめる: 何も変わらない', async ({ page }) => {
  await seed(page, { records: CURRENT });
  await page.goto('/');
  await importBox(page).fill(encodeBackup(INCOMING));
  await section(page).getByRole('button', { name: '読み込む' }).click();
  await importDialog(page).getByRole('button', { name: 'やめる' }).click();
  await expect(importDialog(page)).toBeHidden();
  expect((await readSaved(page)).records).toEqual(CURRENT);
  await expect(importBox(page)).toHaveValue(encodeBackup(INCOMING));
});
