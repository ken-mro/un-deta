// ダークモード（OS 設定に追従）と、ライト／ダーク両方でのコントラスト
import { test, expect } from '@playwright/test';
import { seed, fixToday } from './helpers.js';

test.beforeEach(async ({ page }) => fixToday(page));

// ページ内で WCAG のコントラスト比を計算する（背景は祖先をたどって不透明な色を探す）
async function contrastOf(page, selector) {
  return page.evaluate((sel) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const fg = parse(getComputedStyle(el).color);
    let node = el;
    let bg = null;
    while (node && node.nodeType === 1) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.5) {
        bg = c;
        break;
      }
      node = node.parentElement;
    }
    bg ??= parse(getComputedStyle(document.documentElement).backgroundColor) ?? { r: 255, g: 255, b: 255 };
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return { sel, ratio: (l1 + 0.05) / (l2 + 0.05) };
  }, selector);
}

const TEXT_SELECTORS = [
  '.app-title', '.today', '.today-status', '#btn-done', '#btn-little', '.since', '.hint',
  '.calendar-title', '.calendar-summary', '.calendar-weekdays span', '.cal-day[data-status="0"]:not(:disabled)', '.cal-day[data-status="1"]', '.cal-day[data-status="3"]',
  '.install-banner p', '.reminder p', '.legend li', '#export-text', '.field-label', '#btn-copy', '.muted', '#btn-clear-today',
];

for (const scheme of ['light', 'dark']) {
  test(`${scheme}: 主要な文字のコントラスト比が 4.5:1 以上`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page, { records: { '2024-01-01': 1, '2024-03-07': 1, '2024-03-05': 3 } });
    await page.goto('/');
    for (const sel of TEXT_SELECTORS) {
      const r = await contrastOf(page, sel);
      expect(r.missing, `${sel} が存在する`).toBeUndefined();
      expect(r.ratio, `${sel} のコントラスト比`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('OS がダークモードなら暗い背景・明るい文字になり、ライトに戻すと元に戻る', async ({ page }) => {
  const colors = () =>
    page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      fg: getComputedStyle(document.body).color,
      scheme: getComputedStyle(document.documentElement).colorScheme,
    }));
  const luminance = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const dark = await colors();
  expect(luminance(dark.bg)).toBeLessThan(0.2);
  expect(luminance(dark.fg)).toBeGreaterThan(0.8);
  expect(dark.scheme).toContain('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await colors();
  expect(luminance(light.bg)).toBeGreaterThan(0.9);
  expect(luminance(light.fg)).toBeLessThan(0.2);
});
