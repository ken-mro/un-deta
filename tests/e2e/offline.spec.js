// service worker: オフラインでも起動・記録でき、規約・ポリシーも表示できる
import { test, expect } from '@playwright/test';

async function waitForController(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('一度開いたあとはオフラインでも起動・記録でき、リロード後も残る', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '出た', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await page.reload();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await expect(page.locator('[data-date]')).toHaveCount(365);
});

test('オフラインでも利用規約・プライバシーポリシーを開ける', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);
  await context.setOffline(true);
  await page.getByRole('contentinfo').getByRole('link', { name: '利用規約' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('利用規約');
  await page.goBack();
  await page.getByRole('contentinfo').getByRole('link', { name: 'プライバシーポリシー' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('プライバシーポリシー');
});

test('オフラインでもクエリ付きの URL で起動できる', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);
  await context.setOffline(true);
  await page.goto('/?source=homescreen');
  await expect(page.getByRole('button', { name: '出た', exact: true })).toBeVisible();
});
