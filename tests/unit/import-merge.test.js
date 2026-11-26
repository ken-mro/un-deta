// インポートの「上書き」「統合」
// 衝突 = 同じ日に両方とも記録があり、値が異なる日。統合時は preferIncoming で読み込む側を優先するか選ぶ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overwriteRecords, mergeRecords, analyzeImport } from '../../src/lib/import-merge.js';
import { STATUS, emptyRecords, setStatus } from '../../src/lib/records.js';

const { DONE, NOT_YET } = STATUS;
const build = (entries) => entries.reduce((r, [k, s]) => setStatus(r, k, s), emptyRecords());

const current = build([
  ['2024-01-01', DONE], // 同じ値
  ['2024-01-02', DONE], // 衝突
  ['2024-01-03', NOT_YET], // 現在のみ
]);
const incoming = build([
  ['2024-01-01', DONE],
  ['2024-01-02', NOT_YET],
  ['2024-01-04', DONE], // 読み込み側のみ
]);

test('上書き: 読み込んだ内容だけになる（現在の記録は消える）', () => {
  const r = overwriteRecords(current, incoming);
  assert.deepEqual({ ...r }, { ...incoming });
  assert.ok(Object.isFrozen(r));
});

test('analyzeImport: 追加・衝突・同一・現在のみ を数える', () => {
  const a = analyzeImport(current, incoming);
  assert.deepEqual(a.conflicts, [{ date: '2024-01-02', current: DONE, incoming: NOT_YET }]);
  assert.equal(a.added, 1);
  assert.equal(a.same, 1);
  assert.equal(a.onlyCurrent, 1);
});

test('統合（読み込む側を優先）: 衝突日は読み込み側の値', () => {
  const r = mergeRecords(current, incoming, { preferIncoming: true });
  assert.deepEqual({ ...r }, { '2024-01-01': DONE, '2024-01-02': NOT_YET, '2024-01-03': NOT_YET, '2024-01-04': DONE });
});

test('統合（今の記録を優先）: 衝突日は現在の値のまま', () => {
  const r = mergeRecords(current, incoming, { preferIncoming: false });
  assert.deepEqual({ ...r }, { '2024-01-01': DONE, '2024-01-02': DONE, '2024-01-03': NOT_YET, '2024-01-04': DONE });
});

test('統合: 未記録は相手の記録を消さない（どちらの側でも）', () => {
  const r1 = mergeRecords(current, emptyRecords(), { preferIncoming: true });
  assert.deepEqual({ ...r1 }, { ...current });
  const r2 = mergeRecords(emptyRecords(), incoming, { preferIncoming: false });
  assert.deepEqual({ ...r2 }, { ...incoming });
});

test('統合: 衝突の扱いを指定しないと例外（確認を飛ばさない）', () => {
  assert.throws(() => mergeRecords(current, incoming), TypeError);
  assert.throws(() => mergeRecords(current, incoming, {}), TypeError);
});

test('入力のストアは変更しない', () => {
  const before = { ...current };
  mergeRecords(current, incoming, { preferIncoming: true });
  overwriteRecords(current, incoming);
  assert.deepEqual({ ...current }, before);
});
