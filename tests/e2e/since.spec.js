// 「前回の『出た』から N日」の表示（仕様変更: 「出た」だけを記録）
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10

test('記録がなければ表示しない', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('since')).toBeHidden();
});

test('前回の「出た」からの日数を表示する', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1, '2024-03-07': 1 } });
  await page.goto('/');
  await expect(page.getByTestId('since')).toBeVisible();
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 3日');
});

test('今日「出た」を押すと消え、取り消すとまた表示される', async ({ page }) => {
  await seed(page, { records: { '2024-03-09': 1 } });
  await page.goto('/');
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 1日');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('since')).toBeHidden();
  await page.getByRole('button', { name: '今日の記録を取り消す' }).click();
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 1日');
});

test('旧データの「出てない」は数えない', async ({ page }) => {
  await seed(page, { records: { '2024-03-05': 1, '2024-03-09': 2 } });
  await page.goto('/');
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 5日');
});
