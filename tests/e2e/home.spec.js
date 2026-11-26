// ホーム画面: 今日の記録とリロード後の保持
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // 2024-03-10 10:00（ローカル時刻）に固定
  await page.clock.install({ time: new Date(2024, 2, 10, 10, 0, 0) });
});

const doneBtn = (page) => page.getByRole('button', { name: '出た', exact: true });
const notYetBtn = (page) => page.getByRole('button', { name: '出てない', exact: true });

test('今日の日付と、未記録の状態が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/うん、出た。/);
  await expect(page.getByTestId('today')).toContainText('3月10日');
  await expect(page.getByTestId('today-status')).toHaveText('まだ記録していません');
  await expect(doneBtn(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(notYetBtn(page)).toHaveAttribute('aria-pressed', 'false');
});

test('「出た」で今日が記録され、リロード後も保持される', async ({ page }) => {
  await page.goto('/');
  await doneBtn(page).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await expect(doneBtn(page)).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await expect(doneBtn(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(notYetBtn(page)).toHaveAttribute('aria-pressed', 'false');
});

test('「出てない」で記録でき、「出た」に付け替えられる', async ({ page }) => {
  await page.goto('/');
  await notYetBtn(page).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出てない」');
  await page.reload();
  await expect(notYetBtn(page)).toHaveAttribute('aria-pressed', 'true');
  await doneBtn(page).click();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  await expect(notYetBtn(page)).toHaveAttribute('aria-pressed', 'false');
});

test('今日の記録を取り消して未記録に戻せる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '今日の記録を取り消す' })).toBeHidden();
  await doneBtn(page).click();
  await page.getByRole('button', { name: '今日の記録を取り消す' }).click();
  await expect(page.getByTestId('today-status')).toHaveText('まだ記録していません');
  await page.reload();
  await expect(page.getByTestId('today-status')).toHaveText('まだ記録していません');
});

test('日付が変わったら新しい日は未記録', async ({ page }) => {
  await page.goto('/');
  await doneBtn(page).click();
  await page.clock.setSystemTime(new Date(2024, 2, 11, 0, 0, 5));
  await page.reload();
  await expect(page.getByTestId('today')).toContainText('3月11日');
  await expect(page.getByTestId('today-status')).toHaveText('まだ記録していません');
});

test('コンソールエラーが出ない', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await doneBtn(page).click();
  expect(errors).toEqual([]);
});
