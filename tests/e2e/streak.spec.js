// 「出てない」連続日数の表示
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

test('連続していなければ表示しない', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('streak')).toBeHidden();
});

test('未記録を挟んだ「出てない」を数えて表示する', async ({ page }) => {
  await seed(page, { records: { '2024-03-05': 1, '2024-03-06': 2, '2024-03-08': 2, '2024-03-09': 2 } });
  await page.goto('/');
  await expect(page.getByTestId('streak')).toBeVisible();
  await expect(page.getByTestId('streak')).toContainText('3日');
});

test('記録すると表示が更新される', async ({ page }) => {
  await seed(page, { records: { '2024-03-09': 2 } });
  await page.goto('/');
  await expect(page.getByTestId('streak')).toContainText('1日');
  await page.getByRole('button', { name: '出てない', exact: true }).click();
  await expect(page.getByTestId('streak')).toContainText('2日');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('streak')).toBeHidden();
});
