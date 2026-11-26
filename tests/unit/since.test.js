// 「前回の『出た』から N日」（仕様変更: 「出た」だけを記録する）
// - 基準日（今日）以前で最後の「出た」から何日たったか
// - 一度も「出た」がなければ null（表示しない）
// - 今日「出た」なら 0（UI では表示しない）
// - 基準日より未来の記録は無視する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSinceLastDone } from '../../src/lib/since.js';
import { STATUS } from '../../src/lib/records.js';

const D = STATUS.DONE;

test('記録なしは null', () => {
  assert.equal(daysSinceLastDone({}, '2024-03-10'), null);
});

test('今日「出た」なら 0', () => {
  assert.equal(daysSinceLastDone({ '2024-03-10': D }, '2024-03-10'), 0);
});

test('最後の「出た」からの日数（月跨ぎ・うるう年・年跨ぎ）', () => {
  assert.equal(daysSinceLastDone({ '2024-03-07': D }, '2024-03-10'), 3);
  assert.equal(daysSinceLastDone({ '2024-02-28': D, '2024-01-01': D }, '2024-03-01'), 2);
  assert.equal(daysSinceLastDone({ '2023-12-31': D }, '2024-01-01'), 1);
});

test('「出た」以外の値（旧データの「出てない」など）は無視する', () => {
  assert.equal(daysSinceLastDone({ '2024-03-05': D, '2024-03-09': STATUS.NOT_YET }, '2024-03-10'), 5);
  assert.equal(daysSinceLastDone({ '2024-03-09': STATUS.NOT_YET }, '2024-03-10'), null);
});

test('基準日より未来の記録は無視する', () => {
  assert.equal(daysSinceLastDone({ '2024-03-01': D, '2024-03-12': D }, '2024-03-10'), 9);
  assert.equal(daysSinceLastDone({ '2024-03-12': D }, '2024-03-10'), null);
});

test('不正な基準日は例外', () => {
  assert.throws(() => daysSinceLastDone({}, '2024-02-30'), RangeError);
});
