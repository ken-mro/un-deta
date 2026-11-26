// 「前回の『出た』から N日」（純粋関数）
import { diffDays, isValidDateKey } from './date.js';
import { STATUS } from './records.js';

/** 基準日以前で最後の「出た」からの日数。一度もなければ null */
export function daysSinceLastDone(records, todayKey) {
  if (!isValidDateKey(todayKey)) throw new RangeError(`不正な日付キーです: ${String(todayKey)}`);
  let last = null;
  for (const k of Object.keys(records)) {
    if (records[k] === STATUS.DONE && k <= todayKey && (last === null || k > last)) last = k;
  }
  return last === null ? null : diffDays(last, todayKey);
}
