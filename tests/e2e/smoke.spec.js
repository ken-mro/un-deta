// Playwright と serve.mjs が両ブラウザで動くことの確認
import { test, expect } from '@playwright/test';

test('serve.mjs 経由でページを開ける', async ({ page }) => {
  const res = await page.goto('/tests/fixtures/site/index.html');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('fixture');
});

test('serve.mjs はドットファイルを返さない', async ({ request }) => {
  const res = await request.get('/.git/HEAD');
  expect(res.status()).toBe(404);
});
