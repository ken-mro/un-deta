// Playwright 設定（chromium + webkit Mobile Safari、webServer は scripts/serve.mjs）の検証
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('chromium と webkit(Mobile Safari) のプロジェクトがあり、webServer は serve.mjs', async () => {
  const { default: config } = await import('../../playwright.config.js');
  const projects = Object.fromEntries(config.projects.map((p) => [p.name, p.use]));
  assert.equal(projects.chromium?.browserName ?? 'chromium', 'chromium');
  assert.equal(projects['Mobile Safari']?.browserName, 'webkit');
  assert.equal(projects['Mobile Safari']?.isMobile, true);
  assert.match(config.webServer.command, /scripts\/serve\.mjs/);
  assert.match(config.use.baseURL, /^http:\/\/127\.0\.0\.1:\d+/);
  assert.equal(config.testDir, './tests/e2e');
  assert.equal(config.webServer.reuseExistingServer, false, '別のサーバを誤って使わない');
});
