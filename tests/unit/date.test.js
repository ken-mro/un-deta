// 日付ユーティリティ（ローカル時刻基準の YYYY-MM-DD キー）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDateKey, parseDateKey, isValidDateKey, addDays, diffDays } from '../../src/lib/date.js';

test('toDateKey: ローカル時刻で YYYY-MM-DD（ゼロ埋め）', () => {
  assert.equal(toDateKey(new Date(2024, 0, 5)), '2024-01-05');
  assert.equal(toDateKey(new Date(2024, 11, 31, 23, 59, 59, 999)), '2024-12-31');
  assert.equal(toDateKey(new Date(2025, 0, 1, 0, 0, 0, 0)), '2025-01-01');
  assert.equal(toDateKey(new Date(987, 2, 9)), '0987-03-09');
});

test('toDateKey: 不正な Date は例外', () => {
  assert.throws(() => toDateKey(new Date(NaN)), TypeError);
  assert.throws(() => toDateKey('2024-01-01'), TypeError);
});

test('isValidDateKey: 形式と実在日をチェック', () => {
  for (const k of ['2024-02-29', '2023-12-31', '2000-02-29']) assert.equal(isValidDateKey(k), true, k);
  for (const k of ['2023-02-29', '1900-02-29', '2024-13-01', '2024-00-10', '2024-04-31', '2024-1-01', '24-01-01', '2024/01/01', '', null, 20240101, '2024-01-01x']) {
    assert.equal(isValidDateKey(k), false, String(k));
  }
});

test('parseDateKey: ローカルの0時の Date を返し、往復で一致', () => {
  const d = parseDateKey('2024-03-10');
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 10);
  assert.equal(toDateKey(d), '2024-03-10');
  assert.throws(() => parseDateKey('2023-02-29'), RangeError);
});

test('addDays: 月末・うるう年・年跨ぎ', () => {
  assert.equal(addDays('2024-01-31', 1), '2024-02-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2023-02-28', 1), '2023-03-01');
  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
  assert.equal(addDays('2025-01-01', -1), '2024-12-31');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2024-01-01', 366), '2025-01-01');
  assert.equal(addDays('2024-05-05', 0), '2024-05-05');
  assert.throws(() => addDays('2024-05-05', 1.5), RangeError);
  assert.throws(() => addDays('bad', 1), RangeError);
});

test('diffDays: b - a の日数（月末・うるう年・年跨ぎ）', () => {
  assert.equal(diffDays('2024-01-01', '2024-01-01'), 0);
  assert.equal(diffDays('2024-01-31', '2024-02-01'), 1);
  assert.equal(diffDays('2024-02-01', '2024-03-01'), 29);
  assert.equal(diffDays('2023-02-01', '2023-03-01'), 28);
  assert.equal(diffDays('2024-12-31', '2025-01-01'), 1);
  assert.equal(diffDays('2025-01-01', '2024-01-01'), -366);
});

test('夏時間のあるタイムゾーンでも日数がずれない（DST 跨ぎ）', () => {
  // TZ に依存しない設計の確認: 3月・11月の切替を跨いでも整数日
  assert.equal(diffDays('2024-03-09', '2024-03-11'), 2);
  assert.equal(addDays('2024-03-09', 2), '2024-03-11');
  assert.equal(diffDays('2024-11-02', '2024-11-04'), 2);
  assert.equal(addDays('2024-10-26', 2), '2024-10-28');
});
