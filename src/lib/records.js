// 記録ストア（純粋関数・不変）。記録は { 'YYYY-MM-DD': 1 | 2 } の形で持ち、未記録の日はキー自体を持たない。
import { isValidDateKey } from './date.js';

/** 状態値。バックアップの 2bit 値と同じ */
export const STATUS = Object.freeze({ NONE: 0, DONE: 1, NOT_YET: 2 });

export const isValidStatus = (s) => s === STATUS.NONE || s === STATUS.DONE || s === STATUS.NOT_YET;

function assertKey(key) {
  if (!isValidDateKey(key)) throw new RangeError(`不正な日付キーです: ${String(key)}`);
}

export const emptyRecords = () => Object.freeze({});

export function getStatus(records, key) {
  assertKey(key);
  return Object.hasOwn(records, key) ? records[key] : STATUS.NONE;
}

export function setStatus(records, key, status) {
  assertKey(key);
  if (!isValidStatus(status)) throw new RangeError(`不正な状態値です: ${String(status)}`);
  if (status === STATUS.NONE) return clearStatus(records, key);
  return Object.freeze({ ...records, [key]: status });
}

export function clearStatus(records, key) {
  assertKey(key);
  if (!Object.hasOwn(records, key)) return records;
  const { [key]: _removed, ...rest } = records;
  return Object.freeze(rest);
}

/** 記録済み（出た／出てない）の日数 */
export const countRecords = (records) => Object.keys(records).length;

/** 「出た」だけを残す（仕様変更により「出てない」は記録しない。旧データ・読み込みデータは未記録として扱う） */
export function onlyDone(records) {
  const out = {};
  for (const k of Object.keys(records)) if (records[k] === STATUS.DONE) out[k] = STATUS.DONE;
  return Object.freeze(out);
}
