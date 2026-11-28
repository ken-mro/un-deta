// 外部リクエストが一切ないこと（同一オリジン以外への要求があれば失敗）
import { test, expect } from '@playwright/test';
import { fixToday, openBackup } from './helpers.js';

test('全ページ・全機能を使っても、同一オリジン以外への通信が発生しない', async ({ page, context, baseURL }) => {
  await fixToday(page);
  const origin = new URL(baseURL).origin;
  const external = [];
  // 外部への要求は記録したうえで遮断する（万一あってもネットワークに出さない）
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origin) return route.continue();
    external.push(url);
    return route.abort();
  });
  // CSP が送信前に遮断した外部アクセスの試みも検出する
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const list = JSON.parse(sessionStorage.getItem('__csp') ?? '[]');
      list.push(`${e.violatedDirective} ${e.blockedURI}`);
      sessionStorage.setItem('__csp', JSON.stringify(list));
    });
  });
  const cspViolations = [];
  const collectCsp = async () => {
    const list = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__csp') ?? '[]'));
    cspViolations.push(...list);
    await page.evaluate(() => sessionStorage.removeItem('__csp'));
  };
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });
  context.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin) external.push(url);
  });

  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await page.locator('[data-cal-date="2024-03-01"]').click();
  await page.getByRole('dialog').getByRole('button', { name: '出た', exact: true }).click();
  await page.getByText('追加のしかた').click();
  await openBackup(page);
  await page.getByText('QRコードで表示').click();
  await page.getByText('機種変更するときは').click();
  const section = page.getByRole('region', { name: 'バックアップ' });
  await section.getByLabel('バックアップの文字列を貼り付け').fill(await section.getByLabel('バックアップ用の文字列').inputValue());
  await section.getByRole('button', { name: '読み込む' }).click();
  await page.getByRole('dialog', { name: 'バックアップの読み込み' }).getByRole('button', { name: '統合する' }).click();
  await collectCsp();
  await page.reload();
  await page.getByRole('contentinfo').getByRole('link', { name: '利用規約' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('利用規約');
  await collectCsp();
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('プライバシーポリシー');
  await page.goto('/manifest.webmanifest');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await collectCsp();

  expect(external).toEqual([]);
  expect(cspViolations, 'CSP に遮断された外部アクセスの試みもない').toEqual([]);
});
