// 月のカレンダー表示（日付タップで修正）
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved, calendar, day } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10（日）

test('今月のカレンダーと「出た」日数が表示される', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1, '2024-03-09': 1, '2024-02-29': 1 } });
  await page.goto('/');
  await expect(calendar(page)).toBeVisible();
  await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年3月');
  await expect(calendar(page).getByTestId('calendar-summary')).toHaveText('出た 2日');
  await expect(calendar(page).locator('[data-cal-date]')).toHaveCount(31);
  await expect(day(page, '2024-03-09')).toHaveAttribute('data-status', '1');
  await expect(day(page, '2024-03-08')).toHaveAttribute('data-status', '0');
  await expect(day(page, '2024-03-09')).toHaveAccessibleName(/2024年3月9日（土） 出た/);
  await expect(day(page, '2024-03-10')).toHaveAttribute('aria-current', 'date');
  await expect(day(page, '2024-03-01')).toHaveText(/^1/);
});

test('曜日の見出しがあり、1日は正しい曜日の列にある（2024年3月1日は金曜）', async ({ page }) => {
  await page.goto('/');
  const headers = calendar(page).getByTestId('calendar-weekdays').locator('span');
  await expect(headers).toHaveText(['日', '月', '火', '水', '木', '金', '土']);
  const col = await day(page, '2024-03-01').evaluate((el) => el.style.gridColumnStart || getComputedStyle(el).gridColumnStart);
  expect(col).toBe('6');
});

test('前の月・次の月に移動でき、今月より先には進めない', async ({ page }) => {
  await seed(page, { records: { '2024-02-14': 1 } });
  await page.goto('/');
  const next = calendar(page).getByRole('button', { name: '次の月' });
  await expect(next).toBeDisabled();
  await calendar(page).getByRole('button', { name: '前の月' }).click();
  await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年2月');
  await expect(calendar(page).locator('[data-cal-date]')).toHaveCount(29);
  await expect(calendar(page).getByTestId('calendar-summary')).toHaveText('出た 1日');
  await expect(day(page, '2024-02-14')).toHaveAttribute('data-status', '1');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年3月');
  await expect(next).toBeDisabled();
});

test('年をまたいで前の月へ移動できる', async ({ page }) => {
  await page.goto('/');
  const prev = calendar(page).getByRole('button', { name: '前の月' });
  for (let i = 0; i < 3; i++) await prev.click();
  await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2023年12月');
});

test('日付をタップして「出た」を記録・取り消しでき、ホームやヒートマップにも反映される', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-05').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('2024年3月5日');
  await dialog.getByRole('button', { name: '出た', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(day(page, '2024-03-05')).toHaveAttribute('data-status', '1');
  await expect(page.locator('[data-date="2024-03-05"]')).toHaveAttribute('data-status', '1');
  await expect(calendar(page).getByTestId('calendar-summary')).toHaveText('出た 1日');
  await expect(page.getByTestId('since')).toHaveText('前回の「出た」から 5日');
  expect((await readSaved(page)).records['2024-03-05']).toBe(1);
  await day(page, '2024-03-05').click();
  await page.getByRole('dialog').getByRole('button', { name: '記録を消す' }).click();
  await expect(day(page, '2024-03-05')).toHaveAttribute('data-status', '0');
});

test('ホームで記録するとカレンダーにも反映される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  await expect(day(page, '2024-03-10')).toHaveAttribute('data-status', '1');
  await expect(calendar(page).getByTestId('calendar-summary')).toHaveText('出た 1日');
});

test('未来の日は押せない', async ({ page }) => {
  await page.goto('/');
  await expect(day(page, '2024-03-11')).toBeDisabled();
  await expect(day(page, '2024-03-31')).toBeDisabled();
  await expect(day(page, '2024-03-10')).toBeEnabled();
});

test('キャンセル（ボタン・Escape）では変更しない', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1 } });
  await page.goto('/');
  await day(page, '2024-03-01').click();
  await page.getByRole('dialog').getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await day(page, '2024-03-01').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(day(page, '2024-03-01')).toHaveAttribute('data-status', '1');
  expect((await readSaved(page)).records['2024-03-01']).toBe(1);
});

test('今日のマスを修正するとホームの状態も変わる', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-10').click();
  await page.getByRole('dialog').getByRole('button', { name: '出た', exact: true }).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
});

test('閉じたらフォーカスがカレンダーの日付に戻る', async ({ page }) => {
  await page.goto('/');
  await day(page, '2024-03-04').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(day(page, '2024-03-04')).toBeFocused();
});

test.describe('キーボード操作', () => {
  test('Tab で止まるのは1マスだけ（今日）', async ({ page }) => {
    await page.goto('/');
    await expect(day(page, '2024-03-10')).toHaveAttribute('tabindex', '0');
    await expect(day(page, '2024-03-09')).toHaveAttribute('tabindex', '-1');
  });

  test('矢印で ±1日 / ±7日、Enter で開く', async ({ page }) => {
    await page.goto('/');
    await day(page, '2024-03-10').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(day(page, '2024-03-09')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(day(page, '2024-03-02')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(day(page, '2024-03-03')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2024-03-10')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('2024年3月9日');
  });

  test('未来の日には移動しない', async ({ page }) => {
    await page.goto('/');
    await day(page, '2024-03-10').focus();
    await page.keyboard.press('ArrowRight');
    await expect(day(page, '2024-03-10')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2024-03-10')).toBeFocused();
  });

  test('月の境目を越えると隣の月に切り替わる', async ({ page }) => {
    await page.goto('/');
    await day(page, '2024-03-10').focus();
    await page.keyboard.press('ArrowUp'); // 3/3
    await page.keyboard.press('ArrowUp'); // 2/25
    await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年2月');
    await expect(day(page, '2024-02-25')).toBeFocused();
    await page.keyboard.press('ArrowDown'); // 3/3
    await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年3月');
    await expect(day(page, '2024-03-03')).toBeFocused();
  });

  test('PageUp / PageDown で月を切り替える（日にちは月末に丸める）', async ({ page }) => {
    await page.goto('/');
    await day(page, '2024-03-10').focus();
    await page.keyboard.press('PageUp');
    await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年2月');
    await expect(day(page, '2024-02-10')).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect(day(page, '2024-03-10')).toBeFocused();
    await page.keyboard.press('PageDown'); // 未来の月には行かない
    await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年3月');
  });

  test('PageDown で 1月31日 → 2月29日（月末に丸める）', async ({ page }) => {
    await page.goto('/');
    await day(page, '2024-03-10').focus();
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageUp');
    await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年1月');
    await day(page, '2024-01-31').focus();
    await page.keyboard.press('PageDown');
    await expect(calendar(page).getByTestId('calendar-title')).toHaveText('2024年2月');
    await expect(day(page, '2024-02-29')).toBeFocused();
  });
});
