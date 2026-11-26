// ヒートマップ（直近1年）: 見るだけの表示。マスが小さいので押しても反応しない（修正はカレンダーから）
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

const heatmap = (page) => page.getByRole('region', { name: 'これまでの記録' });
const cell = (page, date) => page.locator(`[data-date="${date}"]`);

test('直近1年分（365日）のマスがあり、状態が表示される', async ({ page }) => {
  await seed(page, { records: { '2024-03-09': 1, '2024-03-08': 2, '2023-06-01': 1 } }); // 2 は旧データの「出てない」
  await page.goto('/');
  await expect(heatmap(page)).toBeVisible();
  await expect(heatmap(page).locator('[data-date]')).toHaveCount(365);
  await expect(cell(page, '2024-03-10')).toHaveAttribute('data-status', '0');
  await expect(cell(page, '2024-03-09')).toHaveAttribute('data-status', '1');
  await expect(cell(page, '2024-03-08')).toHaveAttribute('data-status', '0'); // 旧データの「出てない」は未記録として表示
  await expect(cell(page, '2023-03-11')).toHaveCount(0);
  await expect(cell(page, '2024-03-11')).toHaveCount(0);
});

test('読み上げ用に、直近1年の「出た」日数をまとめて伝える', async ({ page }) => {
  await seed(page, { records: { '2024-03-09': 1, '2023-06-01': 1, '2022-01-01': 1 } });
  await page.goto('/');
  const img = heatmap(page).getByRole('img');
  await expect(img).toHaveAccessibleName('直近1年で「出た」日: 2日');
});

test('ホームで記録するとヒートマップにも反映される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(cell(page, '2024-03-10')).toHaveAttribute('data-status', '1');
  await expect(heatmap(page).getByRole('img')).toHaveAccessibleName('直近1年で「出た」日: 1日');
});

test('凡例は「出た」「ちょっと出た」「未記録」の3つ', async ({ page }) => {
  await page.goto('/');
  const legend = page.getByRole('list', { name: '凡例' }).getByRole('listitem');
  await expect(legend).toHaveText(['出た', 'ちょっと出た', '未記録']);
});

test('マスは押しても反応しない（ボタンではなく、ダイアログも開かない）', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1 } });
  await page.goto('/');
  await expect(heatmap(page).getByRole('button')).toHaveCount(0);
  await cell(page, '2024-03-01').click({ force: true });
  await cell(page, '2024-03-10').click({ force: true });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(cell(page, '2024-03-01')).toHaveAttribute('data-status', '1');
  const cursor = await cell(page, '2024-03-01').evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).not.toBe('pointer');
});

test('キーボードでもフォーカスされない（Tab が止まらない）', async ({ page }) => {
  await page.goto('/');
  const focusable = await heatmap(page).locator('[data-date]').evaluateAll((els) => els.filter((el) => el.tabIndex >= 0 || el.hasAttribute('tabindex')).length);
  expect(focusable).toBe(0);
});

test('修正はカレンダーからと案内する', async ({ page }) => {
  await page.goto('/');
  await expect(heatmap(page)).toContainText('カレンダー');
  await expect(heatmap(page)).not.toContainText('タップすると');
});
