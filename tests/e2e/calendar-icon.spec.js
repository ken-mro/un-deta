// カレンダーの日付に「出た」「ちょっと出た」のアイコンを出す（マスの大きさ・押しやすさは変えない）
import { test, expect } from '@playwright/test';
import { seed, fixToday, day } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10

const icon = (page, date) => day(page, date).locator('svg.cal-icon');

test('「出た」の日は大きいキャラクター、「ちょっと出た」の日は小さいキャラクター、未記録の日はアイコンなし', async ({ page }) => {
  await seed(page, { records: { '2024-03-04': 1, '2024-03-05': 3 } });
  await page.goto('/');
  await expect(icon(page, '2024-03-04')).toHaveCount(1);
  await expect(icon(page, '2024-03-04')).not.toHaveClass(/poo-mini/);
  await expect(icon(page, '2024-03-05')).toHaveCount(1);
  await expect(icon(page, '2024-03-05')).toHaveClass(/poo-mini/);
  await expect(icon(page, '2024-03-06')).toHaveCount(0);
  // 日付の数字は残り、アイコンは読み上げない（読み上げは aria-label で行う）
  await expect(day(page, '2024-03-04')).toContainText('4');
  await expect(icon(page, '2024-03-04')).toHaveAttribute('aria-hidden', 'true');
  await expect(day(page, '2024-03-04')).toHaveAccessibleName(/3月4日.*出た/);
});

test('アイコンがあってもマスの大きさは変わらず、タップ領域は 44px 以上', async ({ page }) => {
  await seed(page, { records: { '2024-03-04': 1, '2024-03-05': 3 } });
  await page.goto('/');
  const box = async (d) => day(page, d).boundingBox();
  const none = await box('2024-03-06');
  for (const d of ['2024-03-04', '2024-03-05']) {
    const b = await box(d);
    expect(Math.abs(b.width - none.width)).toBeLessThan(0.5);
    expect(Math.abs(b.height - none.height)).toBeLessThan(0.5);
  }
  expect(none.height).toBeGreaterThanOrEqual(44);
  // アイコンはマスの中に収まり、押すとマス（ボタン）が反応する
  const ib = await icon(page, '2024-03-04').boundingBox();
  const cb = await box('2024-03-04');
  expect(ib.x).toBeGreaterThanOrEqual(cb.x);
  expect(ib.y).toBeGreaterThanOrEqual(cb.y);
  expect(ib.x + ib.width).toBeLessThanOrEqual(cb.x + cb.width + 0.5);
  expect(ib.y + ib.height).toBeLessThanOrEqual(cb.y + cb.height + 0.5);
  await icon(page, '2024-03-04').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('アイコンの色はマスの文字色に合わせ、背景に埋もれない', async ({ page }) => {
  await seed(page, { records: { '2024-03-04': 1, '2024-03-05': 3 } });
  await page.goto('/');
  for (const d of ['2024-03-04', '2024-03-05']) {
    const { fill, color, bg } = await day(page, d).evaluate((el) => ({
      fill: getComputedStyle(el.querySelector('.cal-icon .poo-body')).fill,
      color: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));
    expect(fill).toBe(color);
    expect(fill).not.toBe(bg);
  }
});

test('修正ダイアログやまとめて記録で変えると、アイコンもすぐ変わる', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-04').click();
  await page.getByRole('dialog').getByRole('button', { name: 'ちょっと出た' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(icon(page, '2024-03-04')).toHaveClass(/poo-mini/);

  await page.getByRole('button', { name: 'まとめて記録' }).click();
  await day(page, '2024-03-06').click();
  await expect(icon(page, '2024-03-06')).toHaveCount(1);
  await expect(icon(page, '2024-03-06')).not.toHaveClass(/poo-mini/);
  await day(page, '2024-03-06').click();
  await expect(icon(page, '2024-03-06')).toHaveCount(0);
});
