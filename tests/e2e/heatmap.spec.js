// ヒートマップ（直近1年）と、日付タップでの修正・取り消し
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

const cell = (page, date) => page.locator(`[data-date="${date}"]`);

test('直近1年分（365日）のセルがあり、状態が表示される', async ({ page }) => {
  await seed(page, { records: { '2024-03-09': 1, '2024-03-08': 2 } }); // 2 は旧データの「出てない」
  await page.goto('/');
  const heatmap = page.getByRole('region', { name: 'これまでの記録' });
  await expect(heatmap).toBeVisible();
  await expect(heatmap.locator('[data-date]')).toHaveCount(365);
  await expect(cell(page, '2024-03-10')).toHaveAttribute('data-status', '0');
  await expect(cell(page, '2024-03-09')).toHaveAttribute('data-status', '1');
  await expect(cell(page, '2024-03-08')).toHaveAttribute('data-status', '0'); // 旧データの「出てない」は未記録として表示
  await expect(cell(page, '2024-03-09')).toHaveAccessibleName(/2024年3月9日.*出た/);
  await expect(cell(page, '2024-03-07')).toHaveAccessibleName(/2024年3月7日.*未記録/);
  await expect(cell(page, '2023-03-11')).toHaveCount(0);
  await expect(cell(page, '2024-03-11')).toHaveCount(0);
});

test('ホームで記録するとヒートマップにも反映される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(cell(page, '2024-03-10')).toHaveAttribute('data-status', '1');
});

test('過去の日をタップして「出た」を記録でき、リロード後も保持・日数表示も更新', async ({ page }) => {
  await seed(page, { records: { '2024-03-05': 1 } });
  await page.goto('/');
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 5日');
  await cell(page, '2024-03-09').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('2024年3月9日');
  await expect(dialog.getByRole('button', { name: '出てない', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '出た', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(cell(page, '2024-03-09')).toHaveAttribute('data-status', '1');
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 1日');
  await page.reload();
  await expect(cell(page, '2024-03-09')).toHaveAttribute('data-status', '1');
  expect((await readSaved(page)).records['2024-03-09']).toBe(1);
});

test('凡例は「出た」「未記録」の2つ', async ({ page }) => {
  await page.goto('/');
  const legend = page.getByRole('list', { name: '凡例' }).getByRole('listitem');
  await expect(legend).toHaveText(['出た', '未記録']);
});

test('記録を取り消して未記録に戻せる', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1 } });
  await page.goto('/');
  await cell(page, '2024-03-01').click();
  await page.getByRole('dialog').getByRole('button', { name: '記録を消す' }).click();
  await expect(cell(page, '2024-03-01')).toHaveAttribute('data-status', '0');
  expect((await readSaved(page)).records['2024-03-01']).toBeUndefined();
});

test('キャンセル（Escape）では変更しない', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1 } });
  await page.goto('/');
  await cell(page, '2024-03-01').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(cell(page, '2024-03-01')).toHaveAttribute('data-status', '1');
  await cell(page, '2024-03-01').click();
  await page.getByRole('dialog').getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(cell(page, '2024-03-01')).toHaveAttribute('data-status', '1');
});

test('今日のセルを修正するとホームの状態も変わる', async ({ page }) => {
  await page.goto('/');
  await cell(page, '2024-03-10').click();
  await page.getByRole('dialog').getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
});

test('キーボード: Tab で1つだけフォーカスでき、矢印キーで日付を移動、Enter で開く', async ({ page, browserName }) => {
  test.info().annotations.push({ type: 'note', description: browserName });
  await page.goto('/');
  const today = cell(page, '2024-03-10');
  await expect(today).toHaveAttribute('tabindex', '0');
  await expect(cell(page, '2024-03-09')).toHaveAttribute('tabindex', '-1');
  await today.focus();
  await page.keyboard.press('ArrowUp');
  await expect(cell(page, '2024-03-09')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(cell(page, '2024-03-02')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(cell(page, '2024-03-03')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('2024年3月3日');
});
