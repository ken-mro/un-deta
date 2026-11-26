// standalone でないときの警告と、iOS / Android 別のホーム画面追加案内
import { test, expect } from '@playwright/test';
import { fixToday } from './helpers.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const banner = (page) => page.getByRole('region', { name: 'ホーム画面に追加してください' });

/** display-mode: standalone を再現する */
const emulateStandalone = (page) =>
  page.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { ...orig(q), matches: true, media: q } : orig(q));
  });

test.beforeEach(async ({ page }) => fixToday(page));

test.describe('iPhone', () => {
  test.use({ userAgent: IPHONE });

  test('警告と iOS 向けの手順（共有 → ホーム画面に追加）を出す', async ({ page }) => {
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText('このままだと記録が消える可能性があります');
    await expect(page.getByTestId('install-guide')).toHaveAttribute('data-os', 'ios');
    await expect(page.getByTestId('install-guide')).toContainText('共有');
    await expect(page.getByTestId('install-guide')).toContainText('ホーム画面に追加');
  });

  test('ホーム画面から開いた（standalone）ときは出さない', async ({ page }) => {
    await emulateStandalone(page);
    await page.goto('/');
    await expect(banner(page)).toBeHidden();
  });
});

test.describe('Android', () => {
  test.use({ userAgent: ANDROID });

  test('警告と Android 向けの手順（メニュー → ホーム画面に追加 / アプリをインストール）を出す', async ({ page }) => {
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await expect(page.getByTestId('install-guide')).toHaveAttribute('data-os', 'android');
    await expect(page.getByTestId('install-guide')).toContainText('メニュー');
    await expect(page.getByTestId('install-guide')).not.toContainText('共有');
  });
});

test.describe('その他（PC など）', () => {
  test.use({ userAgent: WINDOWS });

  test('警告と一般的な案内を出す', async ({ page }) => {
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await expect(page.getByTestId('install-guide')).toHaveAttribute('data-os', 'other');
  });
});

test('案内は他のOSの手順を表示しない（開くと1つだけ見える）', async ({ page }) => {
  await page.goto('/');
  await page.getByText('追加のしかた').click();
  await expect(page.locator('[data-guide-os]:visible')).toHaveCount(1);
});
