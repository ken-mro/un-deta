// まとめて記録: 出た／ちょっと出たを選んで、カレンダーの日をタップ・なぞって一気に記録する
import { test, expect } from '@playwright/test';
import { seed, fixToday, readSaved } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page)); // 今日 = 2024-03-10

const calendar = (page) => page.getByRole('region', { name: 'カレンダー' });
const day = (page, date) => page.locator(`[data-cal-date="${date}"]`);
const startBulk = (page) => calendar(page).getByRole('button', { name: 'まとめて記録' }).click();
const brushes = (page) => calendar(page).getByRole('group', { name: '記録する内容' });

async function center(loc) {
  const b = await loc.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}

/** 日付を順になぞる（マウスのドラッグ = pointer イベント） */
async function stroke(page, dates) {
  await day(page, dates.at(-1)).scrollIntoViewIfNeeded();
  await day(page, dates[0]).scrollIntoViewIfNeeded();
  const [x0, y0] = await center(day(page, dates[0]));
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const d of dates.slice(1)) {
    const [x, y] = await center(day(page, d));
    await page.mouse.move(x, y, { steps: 4 });
  }
  await page.mouse.up();
}

test('「まとめて記録」で記録する内容を選ぶバーが出て、最初は「出た」が選ばれている', async ({ page }) => {
  await page.goto('/');
  await expect(brushes(page)).toBeHidden();
  await startBulk(page);
  await expect(brushes(page)).toBeVisible();
  await expect(brushes(page).getByRole('button', { name: '出た', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(brushes(page).getByRole('button', { name: 'ちょっと出た', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(calendar(page)).toContainText('タップ');
});

test('タップした日がダイアログなしでその場で記録され、もう一度タップすると未記録に戻る', async ({ page }) => {
  await page.goto('/');
  await startBulk(page);
  for (const d of ['2024-03-02', '2024-03-04', '2024-03-07']) await day(page, d).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  for (const d of ['2024-03-02', '2024-03-04', '2024-03-07']) await expect(day(page, d)).toHaveAttribute('data-status', '1');
  expect((await readSaved(page)).records).toEqual({ '2024-03-02': 1, '2024-03-04': 1, '2024-03-07': 1 });
  await expect(page.locator('[data-date="2024-03-04"]')).toHaveAttribute('data-status', '1'); // ヒートマップにも反映
  await day(page, '2024-03-04').click();
  await expect(day(page, '2024-03-04')).toHaveAttribute('data-status', '0');
  expect((await readSaved(page)).records).toEqual({ '2024-03-02': 1, '2024-03-07': 1 });
});

test('「ちょっと出た」を選ぶと、その記録で付けられる（「出た」の日も置き換わる）', async ({ page }) => {
  await seed(page, { records: { '2024-03-03': 1 } });
  await page.goto('/');
  await startBulk(page);
  await brushes(page).getByRole('button', { name: 'ちょっと出た', exact: true }).click();
  await expect(brushes(page).getByRole('button', { name: 'ちょっと出た', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await day(page, '2024-03-03').click();
  await day(page, '2024-03-05').click();
  expect((await readSaved(page)).records).toEqual({ '2024-03-03': 3, '2024-03-05': 3 });
});

test('なぞった日がまとめて記録される（未来の日はなぞっても変わらない）', async ({ page }) => {
  await page.goto('/');
  await startBulk(page);
  await stroke(page, ['2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07']);
  for (const d of ['2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07']) await expect(day(page, d)).toHaveAttribute('data-status', '1');
  await stroke(page, ['2024-03-10', '2024-03-11', '2024-03-12']); // 今日（日曜）から未来へ
  expect(Object.keys((await readSaved(page)).records).sort()).toEqual(['2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07', '2024-03-10']);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」'); // ホームにも反映
});

test('記録済みの日からなぞり始めると、なぞった日をまとめて未記録に戻す', async ({ page }) => {
  await seed(page, { records: { '2024-03-04': 1, '2024-03-05': 1, '2024-03-06': 3 } });
  await page.goto('/');
  await startBulk(page);
  await stroke(page, ['2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07']);
  expect((await readSaved(page)).records).toEqual({});
});

test('「変更を取り消す」で、まとめて記録を始める前の状態に戻る', async ({ page }) => {
  await seed(page, { records: { '2024-03-01': 1 } });
  await page.goto('/');
  await startBulk(page);
  await stroke(page, ['2024-03-02', '2024-03-03']);
  await day(page, '2024-03-01').click();
  await calendar(page).getByRole('button', { name: '変更を取り消す' }).click();
  expect((await readSaved(page)).records).toEqual({ '2024-03-01': 1 });
  await expect(day(page, '2024-03-02')).toHaveAttribute('data-status', '0');
  await expect(day(page, '2024-03-01')).toHaveAttribute('data-status', '1');
});

test('「完了」で通常に戻り、日付をタップすると修正ダイアログが開く', async ({ page }) => {
  await page.goto('/');
  await startBulk(page);
  await day(page, '2024-03-02').click();
  await calendar(page).getByRole('button', { name: '完了' }).click();
  await expect(brushes(page)).toBeHidden();
  await day(page, '2024-03-05').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await readSaved(page)).records).toEqual({ '2024-03-02': 1 });
});

test('前の月に移動しても続けて記録できる', async ({ page }) => {
  await page.goto('/');
  await startBulk(page);
  await calendar(page).getByRole('button', { name: '前の月' }).click();
  await stroke(page, ['2024-02-27', '2024-02-28', '2024-02-29']);
  expect((await readSaved(page)).records).toEqual({ '2024-02-27': 1, '2024-02-28': 1, '2024-02-29': 1 });
});

test('キーボード（Enter）でも1日ずつ記録・取り消しでき、結果を読み上げる', async ({ page }) => {
  await page.goto('/');
  await startBulk(page);
  await day(page, '2024-03-10').focus();
  await page.keyboard.press('Enter');
  await expect(day(page, '2024-03-10')).toHaveAttribute('data-status', '1');
  await expect(calendar(page).getByRole('status')).toContainText('出た');
  await page.keyboard.press('Enter');
  await expect(day(page, '2024-03-10')).toHaveAttribute('data-status', '0');
  await expect(day(page, '2024-03-10')).toBeFocused();
});
