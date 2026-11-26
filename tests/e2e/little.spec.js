// 「ちょっと出た」の記録（ホーム）
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10

const doneBtn = (page) => page.getByRole('button', { name: '出た', exact: true });
const littleBtn = (page) => page.getByRole('button', { name: 'ちょっと出た', exact: true });

test('「ちょっと出た」で今日が記録され、リロード後も保持される', async ({ page }) => {
  await page.goto('/');
  await expect(littleBtn(page)).toHaveAttribute('aria-pressed', 'false');
  await littleBtn(page).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「ちょっと出た」');
  await expect(littleBtn(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(doneBtn(page)).toHaveAttribute('aria-pressed', 'false');
  expect((await readSaved(page)).records['2024-03-10']).toBe(3);
  await page.reload();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「ちょっと出た」');
  await expect(littleBtn(page)).toHaveAttribute('aria-pressed', 'true');
});

test('「出た」と「ちょっと出た」を付け替えられ、取り消しもできる', async ({ page }) => {
  await page.goto('/');
  await littleBtn(page).click();
  await doneBtn(page).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await expect(littleBtn(page)).toHaveAttribute('aria-pressed', 'false');
  await littleBtn(page).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「ちょっと出た」');
  await page.getByRole('button', { name: '今日の記録を取り消す' }).click();
  await expect(page.getByTestId('today-status')).toHaveText('まだ記録していません');
});

test('演出は控えめな「ちょっとすっきり」', async ({ page }) => {
  await page.goto('/');
  await littleBtn(page).click();
  const fx = page.getByTestId('celebration');
  await expect(fx).toBeVisible();
  await expect(fx).toContainText('ちょっとすっきり');
});

test('「前回の『出た』から N日」は「ちょっと出た」も起点にする', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1, '2024-03-07': 3 } });
  await page.goto('/');
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 3日');
  await littleBtn(page).click();
  await expect(page.getByTestId('since')).toBeHidden();
});

test('「出た」が大きく、「ちょっと出た」は小さめ', async ({ page }) => {
  await page.goto('/');
  const big = await doneBtn(page).boundingBox();
  const small = await littleBtn(page).boundingBox();
  expect(small.width * small.height).toBeLessThan((big.width * big.height) / 2);
});

test.describe('カレンダー・ヒートマップ・修正ダイアログ', () => {
  const day = (page, date) => page.locator(`[data-cal-date="${date}"]`);
  const calendar = (page) => page.getByRole('region', { name: 'カレンダー' });
  const heatmap = (page) => page.getByRole('region', { name: 'これまでの記録' });

  test('カレンダーで「ちょっと出た」を区別して表示し、見出しに日数を出す', async ({ page }) => {
    await seed(page, { records: { '2024-03-01': 1, '2024-03-02': 3, '2024-03-05': 3 } });
    await page.goto('/');
    await expect(day(page, '2024-03-02')).toHaveAttribute('data-status', '3');
    await expect(day(page, '2024-03-02')).toHaveAccessibleName(/2024年3月2日（土） ちょっと出た/);
    await expect(calendar(page).getByTestId('calendar-summary')).toHaveText('出た 1日（ちょっと 2日）');
    const bg = (date) => day(page, date).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg('2024-03-02')).not.toBe(await bg('2024-03-01'));
    expect(await bg('2024-03-02')).not.toBe(await bg('2024-03-03'));
  });

  test('修正ダイアログで「ちょっと出た」を選べる', async ({ page }) => {
    await page.goto('/');
    await day(page, '2024-03-04').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'ちょっと出た', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(day(page, '2024-03-04')).toHaveAttribute('data-status', '3');
    await expect(page.locator('[data-date="2024-03-04"]')).toHaveAttribute('data-status', '3');
    expect((await readSaved(page)).records['2024-03-04']).toBe(3);
    await day(page, '2024-03-04').click();
    await expect(dialog).toContainText('いまの記録: ちょっと出た');
  });

  test('ヒートマップは「ちょっと出た」を別の色で表示し、凡例は3つ', async ({ page }) => {
    await seed(page, { records: { '2024-03-01': 1, '2024-03-02': 3 } });
    await page.goto('/');
    await expect(page.locator('[data-date="2024-03-02"]')).toHaveAttribute('data-status', '3');
    const bg = (date) => page.locator(`[data-date="${date}"]`).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg('2024-03-02')).not.toBe(await bg('2024-03-01'));
    expect(await bg('2024-03-02')).not.toBe(await bg('2024-03-03'));
    await expect(heatmap(page).getByRole('img')).toHaveAccessibleName('直近1年で「出た」日: 1日（ちょっと 1日）');
    await expect(page.getByRole('list', { name: '凡例' }).getByRole('listitem')).toHaveText(['出た', 'ちょっと出た', '未記録']);
  });
});

test('「ちょっと出た」はバックアップに含まれ、読み込みでも保持される（旧「出てない」は無視）', async ({ page }) => {
  const { encodeBackup } = await import('../../src/lib/backup-codec.js');
  await seed(page, { records: { '2024-03-01': 3 } });
  await page.goto('/');
  const section = page.getByRole('region', { name: 'バックアップ' });
  await expect(section.getByLabel('バックアップ用の文字列')).toHaveValue(encodeBackup({ '2024-03-01': 3 }));
  await section.getByLabel('バックアップの文字列を貼り付け').fill(encodeBackup({ '2024-02-20': 3, '2024-02-21': 2, '2024-02-22': 1 }));
  await section.getByRole('button', { name: '読み込む' }).click();
  const dialog = page.getByRole('dialog', { name: 'バックアップの読み込み' });
  await expect(dialog).toContainText('読み込む記録: 2日分');
  await dialog.getByRole('button', { name: '統合する' }).click();
  expect((await readSaved(page)).records).toEqual({ '2024-03-01': 3, '2024-02-20': 3, '2024-02-22': 1 });
});

test.describe('統合で「出た」と「ちょっと出た」がぶつかる日', () => {
  const CURRENT = { '2024-03-01': 1, '2024-03-02': 3 };
  const INCOMING = { '2024-03-01': 3, '2024-02-20': 1 }; // 03-01 が衝突

  async function startMerge(page) {
    const { encodeBackup } = await import('../../src/lib/backup-codec.js');
    await seed(page, { records: CURRENT });
    await page.goto('/');
    const section = page.getByRole('region', { name: 'バックアップ' });
    await section.getByLabel('バックアップの文字列を貼り付け').fill(encodeBackup(INCOMING));
    await section.getByRole('button', { name: '読み込む' }).click();
    const dialog = page.getByRole('dialog', { name: 'バックアップの読み込み' });
    await expect(dialog).toContainText('記録が違う日 1日');
    await dialog.getByRole('button', { name: '統合する' }).click();
    await expect(dialog).toContainText('記録が違う日が 1日 あります');
    await expect(dialog).toContainText('今「出た」、読み込む側「ちょっと出た」');
    return dialog;
  }

  test('読み込む側を優先するか確認する — 読み込む側を優先', async ({ page }) => {
    const dialog = await startMerge(page);
    await dialog.getByRole('button', { name: '読み込む側を優先' }).click();
    await expect(dialog).toBeHidden();
    expect((await readSaved(page)).records).toEqual({ ...CURRENT, ...INCOMING });
  });

  test('今の記録を優先', async ({ page }) => {
    const dialog = await startMerge(page);
    await dialog.getByRole('button', { name: '今の記録を優先' }).click();
    await expect(dialog).toBeHidden();
    expect((await readSaved(page)).records).toEqual({ ...INCOMING, ...CURRENT });
  });

  test('やめる: 何も変わらない', async ({ page }) => {
    const dialog = await startMerge(page);
    await dialog.getByRole('button', { name: 'やめる' }).click();
    await expect(dialog).toBeHidden();
    expect((await readSaved(page)).records).toEqual(CURRENT);
  });
});
