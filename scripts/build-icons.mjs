// icons/*.svg から PNG アイコンを生成する（開発用。Playwright の Chromium を使い、依存を増やさない）
// 使い方: node scripts/build-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../icons/', import.meta.url);
const OUTPUTS = [
  { svg: 'icon.svg', size: 192, out: 'icon-192.png', transparent: true },
  { svg: 'icon.svg', size: 512, out: 'icon-512.png', transparent: true },
  { svg: 'icon-maskable.svg', size: 192, out: 'maskable-192.png' },
  { svg: 'icon-maskable.svg', size: 512, out: 'maskable-512.png' },
  // iOS は角を自動で丸めるので、全面塗りの maskable 版を使う
  { svg: 'icon-maskable.svg', size: 180, out: 'apple-touch-icon.png' },
];

const browser = await chromium.launch();
try {
  for (const { svg, size, out, transparent = false } of OUTPUTS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const data = readFileSync(new URL(svg, dir)).toString('base64');
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${data}" width="${size}" height="${size}" style="display:block"></body></html>`,
    );
    await page.locator('img').evaluate((img) => img.decode());
    writeFileSync(new URL(out, dir), await page.screenshot({ omitBackground: transparent, type: 'png' }));
    await page.close();
    console.log(`icons/${out} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
