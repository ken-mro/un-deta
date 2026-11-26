// アクセシビリティ: ラベル、構造、キーボード操作、フォーカス表示、タップ領域
import { test, expect } from '@playwright/test';
import { fixToday, seed, readSaved } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

// macOS の WebKit（Safari）は既定で Tab がフォーム部品にしか移らず、ボタン等へは Option+Tab で移る
const tabKey = (browserName) => (browserName === 'webkit' ? 'Alt+Tab' : 'Tab');

for (const path of ['/', '/terms.html', '/privacy.html']) {
  test(`${path}: lang="ja"・h1 が1つ・見出しが飛ばない`, async ({ page }) => {
    await page.goto(path);
    expect(await page.getAttribute('html', 'lang')).toBe('ja');
    await expect(page.locator('h1')).toHaveCount(1);
    const levels = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !h.closest('dialog')).map((h) => Number(h.tagName[1])),
    );
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `見出しレベル ${levels.join(',')}`).toBeLessThanOrEqual(1);
  });
}

test('すべてのボタン・リンク・入力欄・画像にアクセシブルな名前がある', async ({ page }) => {
  await page.goto('/');
  const missing = await page.evaluate(() => {
    const nameOf = (el) => {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) return labelledby.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      if (el.labels?.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
      return (el.textContent ?? '').trim();
    };
    return [...document.querySelectorAll('button, a[href], textarea, input, select, summary, [role="img"], dialog')]
      .filter((el) => !nameOf(el))
      .map((el) => el.outerHTML.slice(0, 80));
  });
  expect(missing).toEqual([]);
});

test('キーボードだけで記録できる（Tab で到達、Space / Enter で押せる）', async ({ page, browserName }) => {
  const TAB = tabKey(browserName);
  await page.goto('/');
  const done = page.getByRole('button', { name: '出た', exact: true });
  for (let i = 0; i < 30 && !(await done.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press(TAB);
  await expect(done).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('today-status')).toHaveText('今日は「出た」');
  const clear = page.getByRole('button', { name: '今日の記録を取り消す' });
  for (let i = 0; i < 10 && !(await clear.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press(TAB);
  await expect(clear).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('today-status')).toHaveText('まだ記録していません');
});

test('キーボードだけで過去の日を修正できる（ダイアログ内にフォーカス、閉じたら元のセルへ）', async ({ page, browserName }) => {
  await page.goto('/');
  const today = page.locator('[data-date="2024-03-10"]');
  await today.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press(tabKey(browserName));
  expect(await dialog.evaluate((d) => d.contains(document.activeElement)), 'Tab してもダイアログ内').toBe(true);
  await dialog.getByRole('button', { name: '出た', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-date="2024-03-09"]')).toBeFocused();
  await expect(page.locator('[data-date="2024-03-09"]')).toHaveAttribute('data-status', '1');
});

test('キーボードだけでバックアップを読み込める', async ({ page, browserName }) => {
  await seed(page, { records: { '2024-03-01': 1 } });
  await page.goto('/');
  const section = page.getByRole('region', { name: 'バックアップ' });
  const exported = await section.getByLabel('バックアップ用の文字列').inputValue();
  await section.getByLabel('バックアップの文字列を貼り付け').focus();
  await page.keyboard.insertText(exported);
  await page.keyboard.press(tabKey(browserName));
  await expect(section.getByRole('button', { name: '読み込む' })).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'バックアップの読み込み' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '統合する' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  expect((await readSaved(page)).records).toEqual({ '2024-03-01': 1 });
});

test('キーボードフォーカスが見える（outline がある）', async ({ page, browserName }) => {
  const TAB = tabKey(browserName);
  await page.goto('/');
  for (const name of ['出た']) {
    const btn = page.getByRole('button', { name, exact: true });
    await btn.focus();
    await page.keyboard.press(`Shift+${TAB}`);
    await page.keyboard.press(TAB);
    const outline = await btn.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style, name).not.toBe('none');
    expect(outline.width, name).toBeGreaterThanOrEqual(2);
  }
});

test('主要な操作部品のタップ領域は 44px 以上', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '出た', exact: true }).click();
  const selectors = ['#btn-done', '#btn-clear-today', '#btn-copy', '#btn-import', '.app-footer a', '.install-guide summary', '.qr-details summary', '.device-change summary'];
  for (const sel of selectors) {
    const boxes = await page.locator(sel).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => [r.width, r.height]));
    expect(boxes.length, sel).toBeGreaterThan(0);
    for (const [w, h] of boxes) {
      expect(h, `${sel} の高さ`).toBeGreaterThanOrEqual(44);
      expect(w, `${sel} の幅`).toBeGreaterThanOrEqual(44);
    }
  }
});
