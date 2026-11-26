// 「出てない」連続日数
// 仕様（SPEC 機能3）: 未記録の日は連続を途切れさせない／数えない。
//   基準日（今日）から過去へさかのぼり、「出てない」を数え、「出た」に当たったら止まる。
//   未記録の日は飛ばす（数えないが途切れさせない）。基準日より未来の記録は無視する。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notYetStreak } from '../../src/lib/streak.js';
import { STATUS, emptyRecords, setStatus } from '../../src/lib/records.js';

const { DONE, NOT_YET } = STATUS;
const build = (entries) => entries.reduce((r, [k, s]) => setStatus(r, k, s), emptyRecords());

test('記録なしは 0', () => {
  assert.equal(notYetStreak(emptyRecords(), '2024-01-10'), 0);
});

test('今日「出た」なら 0', () => {
  const r = build([['2024-01-09', NOT_YET], ['2024-01-10', DONE]]);
  assert.equal(notYetStreak(r, '2024-01-10'), 0);
});

test('連続した「出てない」を数える', () => {
  const r = build([['2024-01-07', DONE], ['2024-01-08', NOT_YET], ['2024-01-09', NOT_YET], ['2024-01-10', NOT_YET]]);
  assert.equal(notYetStreak(r, '2024-01-10'), 3);
});

test('未記録の日は数えないが、連続も途切れさせない', () => {
  const r = build([['2024-01-05', DONE], ['2024-01-06', NOT_YET], ['2024-01-08', NOT_YET], ['2024-01-10', NOT_YET]]);
  // 01-07, 01-09 は未記録 → 飛ばして 3
  assert.equal(notYetStreak(r, '2024-01-10'), 3);
});

test('今日が未記録でも、それ以前の連続を表示する', () => {
  const r = build([['2024-01-08', NOT_YET], ['2024-01-09', NOT_YET]]);
  assert.equal(notYetStreak(r, '2024-01-10'), 2);
});

test('「出た」で止まる（それより前の「出てない」は数えない）', () => {
  const r = build([['2024-01-01', NOT_YET], ['2024-01-02', NOT_YET], ['2024-01-03', DONE], ['2024-01-04', NOT_YET]]);
  assert.equal(notYetStreak(r, '2024-01-10'), 1);
});

test('長い未記録期間を挟んでも途切れない（年跨ぎ）', () => {
  const r = build([['2023-12-30', DONE], ['2023-12-31', NOT_YET], ['2024-03-01', NOT_YET]]);
  assert.equal(notYetStreak(r, '2024-03-01'), 2);
});

test('基準日より未来の記録は無視する', () => {
  const r = build([['2024-01-09', NOT_YET], ['2024-01-11', DONE], ['2024-01-12', NOT_YET]]);
  assert.equal(notYetStreak(r, '2024-01-10'), 1);
});

test('不正な基準日は例外', () => {
  assert.throws(() => notYetStreak(emptyRecords(), '2024-02-30'), RangeError);
});
