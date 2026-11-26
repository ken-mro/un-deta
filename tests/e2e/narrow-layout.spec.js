// 狭い画面でもはみ出さない（カレンダーの右側が切れる不具合の回帰テスト）
import { test, expect } from '@playwright/test';
import { fixToday } from './helpers.js';

for (const width of [320, 344, 360, 375]) {
  test(`幅 ${width}px: カレンダーが画面内に収まり、ページが横にスクロールしない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await fixToday(page);
    await page.goto('/');
    const r = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const days = [...document.querySelectorAll('[data-cal-date]')].map((el) => el.getBoundingClientRect().right);
      return {
        vw: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        grid: box('.calendar-grid').right,
        weekdays: box('.calendar-weekdays').right,
        next: box('[data-cal-nav="next"]').right,
        maxDay: Math.max(...days),
      };
    });
    expect(r.scroll, 'ページ全体が横にはみ出さない').toBeLessThanOrEqual(r.vw);
    for (const k of ['grid', 'weekdays', 'next', 'maxDay']) expect(r[k], k).toBeLessThanOrEqual(r.vw);
  });
}
