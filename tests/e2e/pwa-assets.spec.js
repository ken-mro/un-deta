// manifest とアイコンが配信され、ブラウザから参照できる
import { test, expect } from '@playwright/test';

test('manifest とアイコンがすべて 200 で正しい種類で返る', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href, page.url());
  const res = await request.get(manifestUrl.href);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await res.json();
  for (const icon of manifest.icons) {
    const r = await request.get(new URL(icon.src, manifestUrl).href);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()['content-type']).toBe('image/png');
  }
  for (const sel of ['link[rel="apple-touch-icon"]', 'link[rel="icon"][type="image/svg+xml"]']) {
    const iconHref = await page.locator(sel).getAttribute('href');
    expect((await request.get(new URL(iconHref, page.url()).href)).status(), sel).toBe(200);
  }
});
