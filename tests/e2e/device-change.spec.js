// 機種変更手順の説明（iOS のストレージ分離を踏まえた内容）
import { test, expect } from '@playwright/test';
import { fixToday, openBackup } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

test('機種変更の手順が順番どおりに書かれている', async ({ page }) => {
  await page.goto('/');
  await openBackup(page);
  await page.getByText('機種変更するときは').click();
  const steps = page.getByTestId('device-change-steps').locator('li');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('今の端末');
  await expect(steps.nth(0)).toContainText('コピー');
  await expect(steps.nth(1)).toContainText('新しい端末');
  await expect(steps.nth(1)).toContainText('ホーム画面に追加');
  await expect(steps.nth(2)).toContainText('ホーム画面のアイコンから');
  await expect(steps.nth(3)).toContainText('貼り付け');
});

test('iPhone では Safari とホーム画面のアプリで保存場所が別であることを説明する', async ({ page }) => {
  await page.goto('/');
  await openBackup(page);
  await page.getByText('機種変更するときは').click();
  const note = page.getByTestId('ios-storage-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Safari');
  await expect(note).toContainText('別々');
  await expect(note).toContainText('QR');
});
