// ヒートマップのレイアウト（純粋関数）。週ごとの列（日曜始まり）に直近1年を並べる。
import { addDays, diffDays, isValidDateKey } from './date.js';
import { STATUS, getStatus, isRecorded } from './records.js';

export const HEATMAP_DAYS = 365;

/** 0=日曜 … 6=土曜（1970-01-01 は木曜） */
export const dayOfWeek = (key) => (((diffDays('1970-01-01', key) + 4) % 7) + 7) % 7;

/**
 * @returns {{ weeks: Array<Array<{date: string, status: number} | null>>, monthLabels: Array<string|null>, start: string, end: string }}
 */
export function buildHeatmap(records, todayKey) {
  if (!isValidDateKey(todayKey)) throw new RangeError(`不正な日付キーです: ${String(todayKey)}`);
  const end = todayKey;
  const start = addDays(end, -(HEATMAP_DAYS - 1));
  const gridStart = addDays(start, -dayOfWeek(start));
  const weeks = [];
  const monthLabels = [];
  for (let w = 0; ; w++) {
    const col = [];
    let label = null;
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      if (date < start || date > end) {
        col.push(null);
        continue;
      }
      const raw = getStatus(records, date);
      // 旧データの「出てない」は未記録として扱う
      col.push({ date, status: isRecorded(raw) ? raw : STATUS.NONE });
      if (date.endsWith('-01')) label = `${Number(date.slice(5, 7))}月`;
    }
    weeks.push(col);
    monthLabels.push(label);
    if (addDays(gridStart, w * 7 + 6) >= end) break;
  }
  return { weeks, monthLabels, start, end };
}
