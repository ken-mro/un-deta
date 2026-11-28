// 折りたたみ端末（Fold を開いた状態・Duo の2画面）など広い画面: 左にホーム・バックアップ・フッター、
// 右にカレンダーと「これまでの記録」を切り替えて表示する。スマホの幅では今までどおり縦に並べる。
import { test, expect } from '@playwright/test';
import { seed, fixToday, widgetSwitch } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

const calendar = (page) => page.locator('#calendar');
const history = (page) => page.locator('#history');
const tab = (page, name) => widgetSwitch(page).getByRole('button', { name });
const rect = (loc) => loc.evaluate((el) => el.getBoundingClientRect().toJSON());

test.describe('Fold を開いた状態（約 690×830）', () => {
  test.use({ viewport: { width: 690, height: 830 } });

  test('左にホーム・バックアップ・フッター、右にカレンダー', async ({ page }) => {
    await page.goto('/');
    const half = 690 / 2;
    for (const sel of ['.app-header', '.record', '#backup', '.app-footer']) {
      const r = await rect(page.locator(sel));
      expect(r.right, sel).toBeLessThanOrEqual(half + 0.5);
    }
    const cal = await rect(calendar(page));
    expect(cal.left).toBeGreaterThanOrEqual(half - 0.5);
    expect(cal.right).toBeLessThanOrEqual(690 + 0.5);
    // ページ全体は横にはみ出さない
    const { scroll, vw } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(vw);
  });

  test('右側はカレンダーと「これまでの記録」を切り替えて表示する（最初はカレンダー）', async ({ page }) => {
    await seed(page, { records: { '2024-03-09': 1 } });
    await page.goto('/');
    await expect(tab(page, 'カレンダー')).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(page, 'これまでの記録')).toHaveAttribute('aria-pressed', 'false');
    await expect(calendar(page)).toBeVisible();
    await expect(history(page)).toBeHidden();

    await tab(page, 'これまでの記録').click();
    await expect(tab(page, 'これまでの記録')).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(page, 'カレンダー')).toHaveAttribute('aria-pressed', 'false');
    await expect(history(page)).toBeVisible();
    await expect(calendar(page)).toBeHidden();
    // 右側に表示され、直近の週（右端）が見えるようにスクロールされている
    const h = await rect(history(page));
    expect(h.left).toBeGreaterThanOrEqual(345 - 0.5);
    const scroll = await page.locator('#heatmap').evaluate((el) => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth }));
    expect(scroll.left).toBeGreaterThanOrEqual(scroll.max - 1);

    await tab(page, 'カレンダー').click();
    await expect(calendar(page)).toBeVisible();
    await expect(history(page)).toBeHidden();
  });

  test('切り替えボタンはタップしやすい大きさで、キーボードでも操作できる', async ({ page }) => {
    await page.goto('/');
    for (const name of ['カレンダー', 'これまでの記録']) {
      const b = await tab(page, name).boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await tab(page, 'これまでの記録').focus();
    await page.keyboard.press('Enter');
    await expect(history(page)).toBeVisible();
  });

  test('右側で記録を直すと、左のホームにも反映される', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-cal-date="2024-03-10"]').click();
    await page.getByRole('dialog').getByRole('button', { name: '出た', exact: true }).click();
    await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  });
});

test.describe('Fold を開いて横向き（約 830×690）', () => {
  test.use({ viewport: { width: 830, height: 690 } });

  test('横向きでも左右に分けて表示する', async ({ page }) => {
    await page.goto('/');
    expect((await rect(page.locator('.record'))).right).toBeLessThanOrEqual(415 + 0.5);
    expect((await rect(calendar(page))).left).toBeGreaterThanOrEqual(415 - 0.5);
  });
});

for (const [label, viewport] of [
  ['スマホ縦（375×812）', { width: 375, height: 812 }],
  ['Fold を閉じた状態（344×882）', { width: 344, height: 882 }],
  ['スマホ横（844×390）', { width: 844, height: 390 }],
]) {
  test.describe(label, () => {
    test.use({ viewport });

    test('今までどおり縦に並べ、カレンダーと「これまでの記録」を両方表示する（切り替えボタンなし）', async ({ page }) => {
      await page.goto('/');
      await expect(widgetSwitch(page)).toBeHidden();
      await expect(calendar(page)).toBeVisible();
      await expect(history(page)).toBeVisible();
      const order = await page.evaluate(() =>
        ['.record', '#calendar', '#history', '#backup'].map((s) => document.querySelector(s).getBoundingClientRect().top),
      );
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });
}

test.describe('Duo（2画面にまたがって表示、ヒンジあり）', () => {
  test.use({ viewport: { width: 1114, height: 720 } });

  test('左の画面にホーム、右の画面にカレンダーを出し、ヒンジにかからない', async ({ page, browserName }) => {
    // 画面の継ぎ目のエミュレーションは Chromium だけ。ほかのブラウザでは継ぎ目なしの広い画面（半分ずつ）になることを確かめる
    const emulated = browserName === 'chromium';
    if (emulated) {
      const cdp = await page.context().newCDPSession(page);
      // 540px の画面2枚 + 34px のヒンジ（縦の継ぎ目）
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1114,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false,
        displayFeature: { orientation: 'vertical', offset: 540, maskLength: 34 },
      });
    }
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(horizontal-viewport-segments: 2)').matches)).toBe(emulated);
    const [leftEnd, rightStart] = emulated ? [540, 574] : [557, 557];
    for (const sel of ['.app-header', '.record', '#backup', '.app-footer']) {
      expect((await rect(page.locator(sel))).right, sel).toBeLessThanOrEqual(leftEnd + 0.5);
    }
    expect((await rect(page.locator('.widgets'))).left).toBeGreaterThanOrEqual(rightStart - 0.5);
  });
});
