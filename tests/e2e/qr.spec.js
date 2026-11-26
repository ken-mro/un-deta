// QR コード表示（自前実装・外部リクエストなし）
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';
import { encodeBackup } from '../../src/lib/backup-codec.js';
import { encodeQR, qrToSvgPath } from '../../src/lib/qr.js';

test.beforeEach(async ({ page }) => fixToday(page));

const RECORDS = { '2024-03-01': 1, '2024-03-02': 2, '2024-03-05': 1 };

test('バックアップ文字列と同じ内容の QR コードを表示する', async ({ page }) => {
  await seed(page, { records: RECORDS });
  await page.goto('/');
  await page.getByText('QRコードで表示').click();
  const qr = page.getByRole('img', { name: 'バックアップのQRコード' });
  await expect(qr).toBeVisible();
  const expected = encodeQR(encodeBackup(RECORDS));
  await expect(qr).toHaveAttribute('viewBox', `0 0 ${expected.size + 8} ${expected.size + 8}`);
  await expect(qr.locator('path')).toHaveAttribute('d', qrToSvgPath(expected.modules));
});

test('記録が変わると QR も更新される', async ({ page }) => {
  await seed(page, { records: RECORDS });
  await page.goto('/');
  await page.getByText('QRコードで表示').click();
  await page.getByRole('button', { name: '出た', exact: true }).click();
  const expected = encodeQR(encodeBackup({ ...RECORDS, '2024-03-10': 1 }));
  await expect(page.getByRole('img', { name: 'バックアップのQRコード' }).locator('path')).toHaveAttribute('d', qrToSvgPath(expected.modules));
});

test('QR を読み取っても、アプリ内で貼り付けが必要なことを説明する', async ({ page }) => {
  await page.goto('/');
  await page.getByText('QRコードで表示').click();
  await expect(page.getByTestId('qr-note')).toContainText('貼り付け');
});
