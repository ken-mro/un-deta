// まとめて記録（カレンダーをタップ・なぞって一気に記録する）の判定ロジック（純粋関数）
import { isValidDateKey } from './date.js';
import { STATUS, setStatus } from './records.js';

/**
 * ひと筆（タップ、またはなぞり始めから指を離すまで）で付ける状態を決める。
 * 最初の日がすでに選んだ記録なら「消す」筆、そうでなければ「付ける」筆になる。
 * @param {number} firstStatus なぞり始めた日の今の状態
 * @param {number} brush 選んでいる記録（出た／ちょっと出た）
 */
export function strokeTarget(firstStatus, brush) {
  if (brush !== STATUS.DONE && brush !== STATUS.LITTLE) throw new RangeError(`選べない記録です: ${String(brush)}`);
  return firstStatus === brush ? STATUS.NONE : brush;
}

/**
 * 1日分を塗る。未来の日・不正な日付・変化がないときは元の records をそのまま返す。
 */
export function paintDay(records, date, target, todayKey) {
  if (!isValidDateKey(date) || date > todayKey) return records;
  return setStatus(records, date, target);
}
