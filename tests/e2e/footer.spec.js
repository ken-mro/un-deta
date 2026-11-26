// 「データはこの端末の中だけに保存されます」表示と、フッターの規約・ポリシーへのリンク
import { test, expect } from '@playwright/test';
import { fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

test('「データはこの端末の中だけに保存されます」が見える', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('データはこの端末の中だけに保存されます').first()).toBeVisible();
});

test('フッターに利用規約・プライバシーポリシーへの相対リンクがある', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', './terms.html');
  await expect(footer.getByRole('link', { name: 'プライバシーポリシー' })).toHaveAttribute('href', './privacy.html');
  await expect(footer).toContainText('ken_mro');
});
