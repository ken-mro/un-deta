// サブパス（GitHub Pages の /un-deta/）配信でも動く
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';

const BASE = '/un-deta/';
let server;
let origin;

test.beforeAll(async () => {
  server = await startServer({ root: fileURLToPath(new URL('../../', import.meta.url)), port: 0, base: BASE });
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(() => new Promise((r) => server.close(r)));

test('/un-deta/ で起動し、すべてのリクエストがサブパス内で成功する', async ({ page }) => {
  const bad = [];
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith(BASE) || res.status() >= 400) bad.push(`${res.status()} ${url.pathname}`);
  });
  page.on('requestfailed', (req) => bad.push(`failed ${req.url()}`));
  await page.goto(`${origin}${BASE}`);
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await page.reload();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  // manifest とアイコンもサブパス基準で解決される
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(manifestHref, page.url());
  expect(manifestUrl.pathname).toBe(`${BASE}manifest.webmanifest`);
  const manifest = await (await page.request.get(manifestUrl.href)).json();
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(BASE);
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe(BASE);
  for (const icon of manifest.icons) {
    expect((await page.request.get(new URL(icon.src, manifestUrl).href)).status(), icon.src).toBe(200);
  }
  expect(bad).toEqual([]);
});

test('service worker のスコープがサブパスになり、オフラインでも起動できる', async ({ page, context }) => {
  await page.goto(`${origin}${BASE}`);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe(BASE);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '出た', exact: true })).toBeVisible();
});

test('フッターのリンクはサブパス内の規約・ポリシーを開き、戻るリンクでアプリに戻れる', async ({ page }) => {
  await page.goto(`${origin}${BASE}`);
  await page.getByRole('contentinfo').getByRole('link', { name: '利用規約' }).click();
  await expect(page).toHaveURL(`${origin}${BASE}terms.html`);
  await page.getByRole('link', { name: 'アプリに戻る' }).click();
  await expect(page).toHaveURL(`${origin}${BASE}`);
  await page.getByRole('contentinfo').getByRole('link', { name: 'プライバシーポリシー' }).click();
  await expect(page).toHaveURL(`${origin}${BASE}privacy.html`);
});
