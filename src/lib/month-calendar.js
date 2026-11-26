// 月のカレンダーの組み立て（純粋関数）。日曜始まりの週の行に、その月の日付を並べる。
import { addDays, isValidDateKey } from './date.js';
import { dayOfWeek } from './heatmap.js';
import { STATUS } from './records.js';

const MONTH_RE = /^(\d{4})-(\d{2})$/;
const pad = (n, w = 2) => String(n).padStart(w, '0');

/** 'YYYY-MM' として正しいか */
export function isValidMonthKey(key) {
  if (typeof key !== 'string') return false;
  const m = MONTH_RE.exec(key);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** 日付キー → 月キー */
export const monthOf = (dateKey) => dateKey.slice(0, 7);

/** 月キーに n か月（整数）を足す */
export function addMonths(monthKey, n) {
  if (!isValidMonthKey(monthKey)) throw new RangeError(`不正な月キーです: ${String(monthKey)}`);
  if (!Number.isInteger(n)) throw new RangeError('addMonths: 月数は整数で指定してください');
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}`;
}

/**
 * @returns {{ year: number, month: number, weeks: Array<Array<{date: string, day: number, status: number, isToday: boolean, isFuture: boolean} | null>>, doneCount: number, canGoPrev: boolean, canGoNext: boolean }}
 */
export function buildMonthCalendar(records, monthKey, todayKey) {
  if (!isValidMonthKey(monthKey)) throw new RangeError(`不正な月キーです: ${String(monthKey)}`);
  if (!isValidDateKey(todayKey)) throw new RangeError(`不正な日付キーです: ${String(todayKey)}`);
  const first = `${monthKey}-01`;
  const days = [];
  for (let d = first; monthOf(d) === monthKey; d = addDays(d, 1)) days.push(d);

  const cells = [...new Array(dayOfWeek(first)).fill(null)];
  let doneCount = 0;
  for (const date of days) {
    // 仕様変更により「出た」だけを記録する（旧データの「出てない」は未記録として扱う）
    const status = records[date] === STATUS.DONE ? STATUS.DONE : STATUS.NONE;
    const isFuture = date > todayKey;
    if (status === STATUS.DONE && !isFuture) doneCount += 1;
    cells.push({ date, day: Number(date.slice(8)), status, isToday: date === todayKey, isFuture });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const [year, month] = monthKey.split('-').map(Number);
  return { year, month, weeks, doneCount, canGoPrev: true, canGoNext: monthKey < monthOf(todayKey) };
}
