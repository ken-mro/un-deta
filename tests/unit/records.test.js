// 記録ストア（純粋関数）: 未記録／出た／出てない の3値
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, emptyRecords, getStatus, setStatus, clearStatus, countRecords, isValidStatus } from '../../src/lib/records.js';

test('STATUS は 0=未記録, 1=出た, 2=出てない（バックアップの2bit値と一致）', () => {
  assert.deepEqual({ ...STATUS }, { NONE: 0, DONE: 1, NOT_YET: 2 });
  assert.ok(Object.isFrozen(STATUS));
});

test('空のストアではどの日も未記録', () => {
  const r = emptyRecords();
  assert.equal(getStatus(r, '2024-01-01'), STATUS.NONE);
  assert.equal(countRecords(r), 0);
});

test('出た／出てない を設定・取得でき、元のストアは変更しない', () => {
  const r0 = emptyRecords();
  const r1 = setStatus(r0, '2024-01-01', STATUS.DONE);
  const r2 = setStatus(r1, '2024-01-02', STATUS.NOT_YET);
  assert.equal(getStatus(r0, '2024-01-01'), STATUS.NONE, '不変');
  assert.equal(getStatus(r1, '2024-01-01'), STATUS.DONE);
  assert.equal(getStatus(r1, '2024-01-02'), STATUS.NONE);
  assert.equal(getStatus(r2, '2024-01-02'), STATUS.NOT_YET);
  assert.equal(countRecords(r2), 2);
});

test('上書き: 出た → 出てない に修正できる', () => {
  const r = setStatus(setStatus(emptyRecords(), '2024-01-01', STATUS.DONE), '2024-01-01', STATUS.NOT_YET);
  assert.equal(getStatus(r, '2024-01-01'), STATUS.NOT_YET);
  assert.equal(countRecords(r), 1);
});

test('取り消し: 未記録に戻る（「出てない」とは区別される）', () => {
  const r1 = setStatus(emptyRecords(), '2024-01-01', STATUS.NOT_YET);
  const r2 = clearStatus(r1, '2024-01-01');
  assert.equal(getStatus(r2, '2024-01-01'), STATUS.NONE);
  assert.equal(countRecords(r2), 0);
  assert.equal(getStatus(r1, '2024-01-01'), STATUS.NOT_YET, '不変');
  // NONE を set しても取り消しと同じ
  assert.equal(countRecords(setStatus(r1, '2024-01-01', STATUS.NONE)), 0);
  // 未記録の日を取り消しても問題ない
  assert.equal(countRecords(clearStatus(emptyRecords(), '2024-01-01')), 0);
});

test('不正な日付キー・状態値は例外（ストアを壊さない）', () => {
  const r = emptyRecords();
  assert.throws(() => setStatus(r, '2023-02-29', STATUS.DONE), RangeError);
  assert.throws(() => setStatus(r, '__proto__', STATUS.DONE), RangeError);
  assert.throws(() => setStatus(r, '2024-01-01', 3), RangeError);
  assert.throws(() => setStatus(r, '2024-01-01', '1'), RangeError);
  assert.throws(() => getStatus(r, 'x'), RangeError);
  assert.equal(isValidStatus(2), true);
  assert.equal(isValidStatus(-1), false);
});
