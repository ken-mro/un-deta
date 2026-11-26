// データ消失対策: 起動時に navigator.storage.persist() を呼ぶ（非対応ブラウザでも落ちない）
import { test, expect } from '@playwright/test';

test('起動時に persist() を呼ぶ', async ({ page }) => {
  await page.addInitScript(() => {
    window.__persistCalls = 0;
    const storage = navigator.storage ?? {};
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        ...storage,
        estimate: storage.estimate?.bind(storage),
        persisted: async () => false,
        persist: async () => {
          window.__persistCalls += 1;
          return true;
        },
      },
    });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__persistCalls)).toBe(1);
});

test('navigator.storage が無いブラウザでもエラーにならず記録できる', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  expect(errors).toEqual([]);
});

test('persist() が例外を投げてもエラーにならない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: () => { throw new Error('nope'); } },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '出た', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
