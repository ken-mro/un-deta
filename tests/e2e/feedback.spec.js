// 押下時の演出（prefers-reduced-motion では動きを控えめに）
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2024, 2, 10, 10, 0, 0) });
});

const animationName = (loc) => loc.evaluate((el) => getComputedStyle(el).animationName);

test('「出た」で演出が出て、しばらくすると消える', async ({ page }) => {
  await page.goto('/');
  const fx = page.getByTestId('celebration');
  await expect(fx).toBeHidden();
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(fx).toBeVisible();
  await expect(fx).toContainText('すっきり');
  expect(await animationName(fx)).not.toBe('none');
  await expect(fx).toHaveAttribute('aria-hidden', 'true'); // 読み上げは状態テキストで行う
  await page.clock.runFor(3000);
  await expect(fx).toBeHidden();
});

test('「出てない」は控えめな演出', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '出てない', exact: true }).click();
  const fx = page.getByTestId('celebration');
  await expect(fx).toBeVisible();
  await expect(fx).not.toContainText('すっきり');
});

test('reduced-motion では動きのあるアニメーションを使わない', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  const fx = page.getByTestId('celebration');
  await expect(fx).toBeVisible();
  expect(await animationName(fx)).toBe('none');
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="celebration"] *, .btn-done')].filter((el) => getComputedStyle(el).animationName !== 'none').length,
  );
  expect(animated).toBe(0);
  await page.clock.runFor(3000);
  await expect(fx).toBeHidden();
});

test('連打しても演出が溜まらない', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByRole('button', { name: '出た', exact: true });
  for (let i = 0; i < 5; i++) await btn.click();
  await expect(page.getByTestId('celebration')).toHaveCount(1);
});
