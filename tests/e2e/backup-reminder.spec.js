// バックアップ催促の表示
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10

const reminder = (page) => page.getByRole('region', { name: 'バックアップしておく？' });
const OLD = { '2024-02-01': 1, '2024-03-09': 2 };

test('一度もバックアップせず最初の記録から30日以上 → 表示', async ({ page }) => {
  await seed(page, { records: OLD });
  await page.goto('/');
  await expect(reminder(page)).toBeVisible();
});

test('記録が0件なら表示しない', async ({ page }) => {
  await seed(page, { records: {}, lastBackupKey: '2020-01-01' });
  await page.goto('/');
  await expect(reminder(page)).toBeHidden();
});

test('最後のバックアップから30日未満なら表示しない', async ({ page }) => {
  await seed(page, { records: OLD, lastBackupKey: '2024-02-15' });
  await page.goto('/');
  await expect(reminder(page)).toBeHidden();
});

test('「あとで」で閉じると保存され、リロード後も出ない', async ({ page }) => {
  await seed(page, { records: OLD });
  await page.goto('/');
  await reminder(page).getByRole('button', { name: 'あとで' }).click();
  await expect(reminder(page)).toBeHidden();
  expect((await readSaved(page)).dismissedKey).toBe('2024-03-10');
  await page.reload();
  await expect(reminder(page)).toBeHidden();
});

test('「バックアップする」でコピーボタンへ移動し、コピーすると消える', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seed(page, { records: OLD });
  await page.goto('/');
  await reminder(page).getByRole('button', { name: 'バックアップする' }).click();
  const copy = page.getByRole('region', { name: 'バックアップ' }).getByRole('button', { name: 'コピー' });
  await expect(copy).toBeFocused();
  await copy.click();
  await expect(reminder(page)).toBeHidden();
});
