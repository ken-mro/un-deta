// 「出てない」連続日数。
// 基準日から過去へさかのぼり「出てない」を数え、「出た」で止まる。
// 未記録の日は数えないが連続を途切れさせない。基準日より未来の記録は無視する。
import { isValidDateKey } from './date.js';
import { STATUS } from './records.js';

export function notYetStreak(records, todayKey) {
  if (!isValidDateKey(todayKey)) throw new RangeError(`不正な日付キーです: ${String(todayKey)}`);
  // 'YYYY-MM-DD' は文字列比較で日付順になる
  const keys = Object.keys(records)
    .filter((k) => k <= todayKey)
    .sort()
    .reverse();
  let count = 0;
  for (const k of keys) {
    if (records[k] === STATUS.DONE) break;
    if (records[k] === STATUS.NOT_YET) count += 1;
  }
  return count;
}
