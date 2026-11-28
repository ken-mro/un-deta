// まとめて記録（タップ・なぞる）の判定ロジック
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strokeTarget, paintDay } from '../../src/lib/bulk-paint.js';
import { STATUS } from '../../src/lib/records.js';

test('strokeTarget: 最初の日が選んだ記録と違えば、その記録を付ける', () => {
  assert.equal(strokeTarget(STATUS.NONE, STATUS.DONE), STATUS.DONE);
  assert.equal(strokeTarget(STATUS.LITTLE, STATUS.DONE), STATUS.DONE);
  assert.equal(strokeTarget(STATUS.DONE, STATUS.LITTLE), STATUS.LITTLE);
});

test('strokeTarget: 最初の日がすでに選んだ記録なら、未記録に戻す（もう一回タップで取り消し）', () => {
  assert.equal(strokeTarget(STATUS.DONE, STATUS.DONE), STATUS.NONE);
  assert.equal(strokeTarget(STATUS.LITTLE, STATUS.LITTLE), STATUS.NONE);
});

test('strokeTarget: 選べる記録は「出た」「ちょっと出た」だけ', () => {
  assert.throws(() => strokeTarget(STATUS.NONE, STATUS.NONE), RangeError);
  assert.throws(() => strokeTarget(STATUS.NONE, STATUS.NOT_YET), RangeError);
});

test('paintDay: 記録を付ける・消す（元のオブジェクトは変えない）', () => {
  const r0 = Object.freeze({ '2024-03-01': 1 });
  const r1 = paintDay(r0, '2024-03-02', STATUS.LITTLE, '2024-03-10');
  assert.deepEqual(r1, { '2024-03-01': 1, '2024-03-02': 3 });
  assert.deepEqual(r0, { '2024-03-01': 1 });
  assert.deepEqual(paintDay(r1, '2024-03-01', STATUS.NONE, '2024-03-10'), { '2024-03-02': 3 });
});

test('paintDay: 今日は変えられ、未来の日・不正な日付は変えない', () => {
  const r0 = Object.freeze({});
  assert.deepEqual(paintDay(r0, '2024-03-10', STATUS.DONE, '2024-03-10'), { '2024-03-10': 1 });
  assert.equal(paintDay(r0, '2024-03-11', STATUS.DONE, '2024-03-10'), r0);
  assert.equal(paintDay(r0, '2024-02-30', STATUS.DONE, '2024-03-10'), r0);
  assert.equal(paintDay(r0, 'x', STATUS.DONE, '2024-03-10'), r0);
});

test('paintDay: すでに同じ状態なら同じオブジェクトを返す（変更なし）', () => {
  const r0 = Object.freeze({ '2024-03-01': 1 });
  assert.equal(paintDay(r0, '2024-03-01', STATUS.DONE, '2024-03-10'), r0);
  assert.equal(paintDay(r0, '2024-03-05', STATUS.NONE, '2024-03-10'), r0);
});
