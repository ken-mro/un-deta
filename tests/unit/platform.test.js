// プラットフォーム判定（standalone か、iOS / Android / その他か）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectOS, isStandalone, detectPlatform } from '../../src/lib/platform.js';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  ipadOld: 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

test('detectOS: iPhone / iPad / Android / その他', () => {
  assert.equal(detectOS({ userAgent: UA.iphone }), 'ios');
  assert.equal(detectOS({ userAgent: UA.iphoneChrome }), 'ios');
  assert.equal(detectOS({ userAgent: UA.ipadOld }), 'ios');
  assert.equal(detectOS({ userAgent: UA.android }), 'android');
  assert.equal(detectOS({ userAgent: UA.windows }), 'other');
});

test('detectOS: Mac を名乗るタッチ端末（iPadOS）は ios、本物の Mac は other', () => {
  assert.equal(detectOS({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 5 }), 'ios');
  assert.equal(detectOS({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 0 }), 'other');
  assert.equal(detectOS({ userAgent: UA.ipadDesktopMode }), 'other');
});

test('detectOS: 情報がなくても落ちない', () => {
  assert.equal(detectOS({}), 'other');
  assert.equal(detectOS(undefined), 'other');
});

test('isStandalone: display-mode か iOS の navigator.standalone', () => {
  assert.equal(isStandalone({ displayModeStandalone: true }), true);
  assert.equal(isStandalone({ navigatorStandalone: true }), true);
  assert.equal(isStandalone({ displayModeStandalone: false, navigatorStandalone: false }), false);
  assert.equal(isStandalone({}), false);
  assert.equal(isStandalone(undefined), false);
});

test('detectPlatform: まとめて返す', () => {
  assert.deepEqual(detectPlatform({ userAgent: UA.iphone, navigatorStandalone: false, displayModeStandalone: false }), { os: 'ios', standalone: false });
  assert.deepEqual(detectPlatform({ userAgent: UA.android, displayModeStandalone: true }), { os: 'android', standalone: true });
});
