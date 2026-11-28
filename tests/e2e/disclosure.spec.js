// 開閉できる項目（<details>）が「押せる」と分かる見た目と、バックアップ欄の初期状態
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

const SUMMARIES = ['.install-guide summary', '.backup-panel > summary', '.qr-details summary', '.device-change summary'];

test('開閉できる見出しには、ボタンらしい枠と開閉の矢印がある', async ({ page }) => {
  await page.goto('/');
  await page.locator('.backup-panel > summary').click();
  for (const sel of SUMMARIES) {
    const summary = page.locator(sel);
    const look = await summary.evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: parseFloat(s.borderTopWidth), radius: parseFloat(s.borderTopLeftRadius), cursor: s.cursor };
    });
    expect(look.border, `${sel} の枠`).toBeGreaterThanOrEqual(1);
    expect(look.radius, `${sel} の角丸`).toBeGreaterThan(0);
    expect(look.cursor, sel).toBe('pointer');
    await expect(summary.locator('.chevron'), `${sel} の矢印`).toBeVisible();
  }
});

test('「追加のしかた」は押すと開き、矢印の向きが変わる', async ({ page }) => {
  await page.goto('/');
  const guide = page.getByTestId('install-guide');
  const chevron = guide.locator('summary .chevron');
  const before = await chevron.evaluate((el) => getComputedStyle(el).transform);
  await expect(guide.locator('summary')).toContainText('追加のしかた');
  await guide.locator('summary').click();
  await expect(guide).toHaveAttribute('open', '');
  await expect(guide.locator('ol').first()).toBeVisible();
  await expect.poll(() => chevron.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
});

test('バックアップ欄は最初は閉じていて、見出しを押すと開く', async ({ page }) => {
  await page.goto('/');
  const section = page.getByRole('region', { name: 'バックアップ' });
  await expect(section).toBeVisible();
  const panel = section.locator('.backup-panel');
  await expect(panel).not.toHaveAttribute('open', '');
  await expect(section.getByRole('button', { name: 'コピー' })).toBeHidden();
  await panel.locator('> summary').click();
  await expect(panel).toHaveAttribute('open', '');
  await expect(section.getByRole('button', { name: 'コピー' })).toBeVisible();
  await expect(section.getByText('機種変更するときは')).toBeVisible();
});

test('催促の「バックアップする」で、閉じていたバックアップ欄が開いてコピーへ移る', async ({ page }) => {
  await seed(page, { records: { '2024-02-01': 1 } });
  await page.goto('/');
  await page.getByRole('region', { name: 'バックアップしておく？' }).getByRole('button', { name: 'バックアップする' }).click();
  await expect(page.locator('.backup-panel')).toHaveAttribute('open', '');
  await expect(page.getByRole('region', { name: 'バックアップ' }).getByRole('button', { name: 'コピー' })).toBeFocused();
});
