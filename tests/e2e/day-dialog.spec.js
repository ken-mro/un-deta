// カレンダーから日付を指定して記録するときも、今日の記録と同じ手ざわりにする
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved, day } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10

test('ダイアログの「出た」「ちょっと出た」は、ホームと同じキャラクターのボタン', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '出た', exact: true }).locator('svg.poo')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ちょっと出た', exact: true }).locator('svg.poo-mini')).toBeVisible();
});

test('いまの記録のボタンは押された状態で表示する', async ({ page }) => {
  await seed(page, { records: { '2024-03-05': 3 } });
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'ちょっと出た', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: '出た', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('「出た」を押すと、ダイアログの中で「すっきり！」の演出が出てから閉じる', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '出た', exact: true }).click();
  const fx = dialog.getByTestId('day-celebration');
  await expect(fx).toBeVisible();
  await expect(fx).toContainText('すっきり！');
  await expect(fx).toHaveAttribute('aria-hidden', 'true');
  expect((await readSaved(page)).records['2024-03-05']).toBe(1); // 記録はすぐ保存
  await expect(dialog).toBeHidden();
  await expect(day(page, '2024-03-05')).toHaveAttribute('data-status', '1');
});

test('「ちょっと出た」は控えめな演出（ちょっとすっきり）', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'ちょっと出た', exact: true }).click();
  const fx = dialog.getByTestId('day-celebration');
  await expect(fx).toContainText('ちょっとすっきり');
  await expect(fx).toHaveClass(/is-quiet/);
  await expect(dialog).toBeHidden();
});

test('「記録を消す」は演出なしですぐ閉じる', async ({ page }) => {
  await seed(page, { records: { '2024-03-05': 1 } });
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '記録を消す' }).click();
  await expect(dialog).toBeHidden();
  await expect(dialog.getByTestId('day-celebration')).toBeHidden();
});

test('reduced-motion では動きのあるアニメーションを使わない', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '出た', exact: true }).click();
  const fx = dialog.getByTestId('day-celebration');
  await expect(fx).toBeVisible();
  expect(await fx.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(dialog).toBeHidden();
});
