// 規約・ポリシーの記述と実装の整合
// privacy.html: 「個人情報・記録データを収集しない」「ブラウザのストレージにのみ保存」「Cookie を使わない」
//               「外部へ送信しない」「キャッシュに記録データは含まれない」
// index.html: 「データはこの端末の中だけに保存されます。どこにも送信しません。」
import { test, expect } from '@playwright/test';
import { openBackup } from './helpers.js';

async function useEverything(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await page.locator('[data-cal-date]:not([disabled])').first().click();
  await page.getByRole('dialog').getByRole('button', { name: '出た', exact: true }).click();
  await openBackup(page);
  await page.getByText('QRコードで表示').click();
  const section = page.getByRole('region', { name: 'バックアップ' });
  await section.getByLabel('バックアップの文字列を貼り付け').fill(await section.getByLabel('バックアップ用の文字列').inputValue());
  await section.getByRole('button', { name: '読み込む' }).click();
  await page.getByRole('dialog', { name: 'バックアップの読み込み' }).getByRole('button', { name: '統合する' }).click();
}

test('Cookie を使わない', async ({ page, context }) => {
  await useEverything(page);
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(await context.cookies()).toEqual([]);
});

test('保存するのは localStorage の un-deta:v1 だけ（sessionStorage・IndexedDB も使わない）', async ({ page }) => {
  await useEverything(page);
  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    idb: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((d) => d.name) : [],
  }));
  expect(storage.local).toEqual(['un-deta:v1']);
  expect(storage.session).toEqual([]);
  expect(storage.idb).toEqual([]);
});

test('service worker のキャッシュはアプリのファイルだけで、記録データを含まない', async ({ page }) => {
  await useEverything(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) out.push({ name, url: req.url });
    }
    return out;
  });
  expect(cached.length).toBeGreaterThan(0);
  const saved = await page.evaluate(() => localStorage.getItem('un-deta:v1'));
  const backup = await page.getByRole('region', { name: 'バックアップ' }).getByLabel('バックアップ用の文字列').inputValue();
  for (const { name, url } of cached) {
    expect(name).toMatch(/^un-deta-/);
    const u = new URL(url);
    expect(u.origin).toBe(new URL(page.url()).origin);
    expect(u.search, `${url} にクエリ（データ）を含まない`).toBe('');
    expect(url).not.toContain(backup);
  }
  expect(saved).toContain('"records"');
});

test('記録や操作の内容を外部に送らない（同一オリジンの GET 以外の通信がない）', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  await useEverything(page);
  const origin = new URL(page.url()).origin;
  for (const r of requests) {
    expect(new URL(r.url).origin, r.url).toBe(origin);
    expect(r.method, r.url).toBe('GET');
    expect(new URL(r.url).search, `${r.url} にデータを載せない`).toBe('');
  }
});

test('ページが読み込むスクリプトは同梱のものだけ', async ({ page }) => {
  for (const path of ['/', '/terms.html', '/privacy.html']) {
    await page.goto(path);
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.getAttribute('src')));
    for (const src of scripts) expect(src, `${path}: ${src}`).toMatch(/^\.\/src\//);
  }
});
