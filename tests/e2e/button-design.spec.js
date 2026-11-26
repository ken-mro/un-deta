// ボタンのデザイン（うんちのキャラクター）とカレンダーの表示（点なし）
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

test('「出た」ボタンはキャラクターの絵（読み上げ対象外）と「出た」の文字', async ({ page }) => {
  await page.goto('/');
  const btn = page.locator('#btn-done');
  await expect(btn.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(btn.locator('.btn-label')).toHaveText('出た');
  await expect(page.getByRole('button', { name: '出た', exact: true })).toBeVisible();
  const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg, 'ボタン自体は丸い塗りではなく、絵で見せる').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test('「ちょっと出た」ボタンも小さいキャラクター付き', async ({ page }) => {
  await page.goto('/');
  const btn = page.locator('#btn-little');
  await expect(btn.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(btn.locator('.btn-label')).toHaveText('ちょっと出た');
});

test('カレンダーのマスに点の印はない', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1, '2024-03-02': 3 } });
  await page.goto('/');
  for (const date of ['2024-03-01', '2024-03-02']) {
    const after = await page.locator(`[data-cal-date="${date}"]`).evaluate((el) => getComputedStyle(el, '::after').content);
    expect(after, date).toMatch(/^(none|normal)$/);
  }
});

test('点がなくても「ちょっと出た」は枠で未記録と区別できる', async ({ page }) => {
  await seed(page, { records: { '2024-03-02': 3 } });
  await page.goto('/');
  const shadow = (date) => page.locator(`[data-cal-date="${date}"]`).evaluate((el) => getComputedStyle(el).boxShadow);
  expect(await shadow('2024-03-02')).not.toBe('none');
  expect(await shadow('2024-03-03')).toBe('none');
});
