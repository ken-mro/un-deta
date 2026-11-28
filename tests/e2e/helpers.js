// E2E 共通ヘルパー
export const STORAGE_KEY = 'un-deta:v1';

/** 最初の読み込み前に保存データを仕込む（リロード時は上書きしない） */
export async function seed(page, { records = {}, lastBackupKey = null, dismissedKey = null } = {}) {
  await page.addInitScript(
    ([key, data]) => {
      if (sessionStorage.getItem('__seeded')) return;
      localStorage.setItem(key, JSON.stringify(data));
      sessionStorage.setItem('__seeded', '1');
    },
    [STORAGE_KEY, { v: 1, records, lastBackupKey, dismissedKey }],
  );
}

/** 2024-03-10 10:00（ローカル時刻）に時計を固定 */
export const fixToday = (page, date = new Date(2024, 2, 10, 10, 0, 0)) => page.clock.install({ time: date });

export const readSaved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);

/** カレンダー欄と、その中の日付セル */
export const calendar = (page) => page.getByRole('region', { name: 'カレンダー' });
export const day = (page, date) => page.locator(`[data-cal-date="${date}"]`);

/** 最初は閉じているバックアップ欄を開く（すでに開いていればそのまま） */
export async function openBackup(page) {
  const panel = page.locator('.backup-panel');
  if ((await panel.getAttribute('open')) === null) await panel.locator('> summary').click();
}

/** 広い画面（右側が切り替え表示）なら「これまでの記録」に切り替える。スマホの幅では両方出ているので何もしない */
export async function showHistory(page) {
  const btn = page.getByRole('group', { name: '右側に表示する内容' }).getByRole('button', { name: 'これまでの記録' });
  if (await btn.isVisible()) await btn.click();
}
